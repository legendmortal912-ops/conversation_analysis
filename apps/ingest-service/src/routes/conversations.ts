import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { scrubPII } from '../middleware/pii-scrubber.js';

const redisConnection = new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const analysisQueue = new Queue('analysis', { connection: redisConnection });
const scoringQueue = new Queue('scoring', { connection: redisConnection });

/**
 * Conversation ingestion routes.
 * Handles creating conversations, adding turns, and ending conversations.
 * Each turn triggers analysis via BullMQ queue.
 */
export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  /**
   * Validate API key from request headers.
   * Returns org/project context or sends 401.
   */
  async function validateApiKey(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<{ orgId: string; projectId: string | null; keyId: string } | null> {
    const apiKey =
      (request.headers['x-api-key'] as string | undefined) ??
      (request.headers['authorization']?.startsWith('Bearer cg_')
        ? request.headers['authorization'].slice(7)
        : undefined);

    if (!apiKey) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key required. Provide via X-API-Key header or Authorization: Bearer cg_...',
      });
      return null;
    }

    const hash = createHash('sha256').update(apiKey).digest('hex');
    const key = await prisma.apiKey.findFirst({
      where: { keyHash: hash, revokedAt: null },
    });

    if (!key) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid API key' });
      return null;
    }

    if (key.expiresAt && key.expiresAt < new Date()) {
      reply.status(401).send({ error: 'Unauthorized', message: 'API key has expired' });
      return null;
    }

    // Update last used timestamp (fire and forget)
    prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => { /* non-critical */ });

    return { orgId: key.orgId, projectId: key.projectId, keyId: key.id };
  }

  // ─── POST /v1/conversations — Create conversation ─────
  app.post('/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await validateApiKey(request, reply);
    if (!auth) return;

    const body = request.body as {
      external_id?: string;
      project_id?: string;
      user_metadata?: Record<string, unknown>;
      started_at?: string;
    };

    const projectId = body.project_id ?? auth.projectId;
    if (!projectId) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'project_id is required (either in request body or bound to API key)',
      });
    }

    // Verify project belongs to the org
    const project = await prisma.project.findFirst({
      where: { id: projectId, orgId: auth.orgId },
    });
    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found in your organization',
      });
    }

    const conversationId = `conv_${randomBytes(12).toString('hex')}`;
    const startedAt = body.started_at ? new Date(body.started_at) : new Date();

    // Store in PostgreSQL for operational data
    await prisma.conversation.create({
      data: {
        id: conversationId,
        projectId,
        orgId: auth.orgId,
        externalId: body.external_id,
        status: 'ACTIVE',
        startedAt: startedAt,
      }
    });

    await prisma.usageEvent.create({
      data: {
        orgId: auth.orgId,
        projectId,
        eventType: 'CONVERSATION_CREATED',
        quantity: 1,
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      },
    });

    // Publish conversation creation event to Redis for real-time clients
    await redisConnection.publish(
      `project:${projectId}:events`,
      JSON.stringify({
        type: 'conversation_created',
        conversation_id: conversationId,
        project_id: projectId,
        external_id: body.external_id ?? null,
        started_at: startedAt.toISOString(),
        timestamp: new Date().toISOString(),
      }),
    );

    logger.info({ conversationId, projectId }, 'Conversation created');

    return reply.status(201).send({
      conversation_id: conversationId,
      project_id: projectId,
      external_id: body.external_id ?? null,
      status: 'active',
      started_at: startedAt.toISOString(),
    });
  });

  // ─── POST /v1/conversations/:id/turns — Add turn ──────
  app.post('/conversations/:id/turns', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await validateApiKey(request, reply);
    if (!auth) return;

    const { id: conversationId } = request.params as { id: string };
    const body = request.body as {
      speaker: 'user' | 'ai';
      content: string;
      timestamp?: string;
    };

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { projectId: true }
    });
    if (!conv) {
      return reply.status(404).send({ error: 'Not Found', message: 'Conversation not found' });
    }
    const projectId = conv.projectId;

    if (!body.speaker || !body.content) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'speaker ("user" or "ai") and content are required',
      });
    }

    if (body.speaker !== 'user' && body.speaker !== 'ai') {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'speaker must be "user" or "ai"',
      });
    }

    const turnId = `turn_${randomBytes(12).toString('hex')}`;
    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();

    // Scrub PII from content before storage
    const { scrubbed, piiDetected } = scrubPII(body.content);

    // Save turn to PostgreSQL
    const turnCount = await prisma.turn.count({ where: { conversationId } });
    await prisma.turn.create({
      data: {
        id: turnId,
        conversationId,
        index: turnCount,
        role: body.speaker === 'user' ? 'USER' : 'ASSISTANT',
        content: body.content,
        contentHash: 'hash',
        previousHash: 'hash',
      }
    });

    // Record usage event for billing
    await prisma.usageEvent.create({
      data: {
        orgId: auth.orgId,
        projectId: projectId,
        eventType: 'TURN_PROCESSED',
        quantity: 1,
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
      },
    });

    // If this is an AI turn, queue it for analysis
    if (body.speaker === 'ai') {
      await analysisQueue.add(
        'analyze-turn',
        {
          conversation_id: conversationId,
          turn_id: turnId,
          ai_content: scrubbed,
          original_content: body.content,
          timestamp: timestamp.toISOString(),
          org_id: auth.orgId,
          project_id: auth.projectId,
          pii_detected: piiDetected,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      );

      logger.info({ turnId, conversationId }, 'AI turn queued for analysis');

      return reply.status(201).send({
        turn_id: turnId,
        conversation_id: conversationId,
        speaker: body.speaker,
        status: 'queued',
        pii_detected: piiDetected,
        timestamp: timestamp.toISOString(),
      });
    }

    // User turns are stored but not analyzed
    logger.info({ turnId, conversationId }, 'User turn recorded');

    return reply.status(201).send({
      turn_id: turnId,
      conversation_id: conversationId,
      speaker: body.speaker,
      status: 'recorded',
      timestamp: timestamp.toISOString(),
    });
  });

  // ─── POST /v1/conversations/:id/end — End conversation and score synchronously ─
  app.post('/conversations/:id/end', async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await validateApiKey(request, reply);
    if (!auth) return;

    const { id: conversationId } = request.params as { id: string };
    const body = request.body as { ended_at?: string } | undefined;
    const endedAt = body?.ended_at ? new Date(body.ended_at) : new Date();

    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { projectId: true }
    });
    if (!conv) {
      return reply.status(404).send({ error: 'Not Found', message: 'Conversation not found' });
    }
    const projectId = conv.projectId;

    const ANALYSIS_ENGINE_URL = process.env['ANALYSIS_ENGINE_URL'] ?? 'http://localhost:8001';

    // Publish end event immediately for real-time clients
    await redisConnection.publish(
      `project:${projectId}:events`,
      JSON.stringify({
        type: 'conversation_ended',
        conversation_id: conversationId,
        ended_at: endedAt.toISOString(),
        timestamp: new Date().toISOString(),
      }),
    );

    // Run scoring synchronously so we can return tilt_score in the response
    try {
      let ignoredCategories: string[] = [];
      let customRules: any[] = [];

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { customRules: { where: { isEnabled: true } } },
      });
      if (project) {
        const settings = project.settings as { ignoredCategories?: string[] };
        if (settings?.ignoredCategories) ignoredCategories = settings.ignoredCategories;
        customRules = project.customRules.map((r: any) => ({
          id: r.id, name: r.name, patterns: r.patterns, severity: r.severity.toLowerCase(),
        }));
      }

      const turns = await prisma.turn.findMany({
        where: { conversationId },
        orderBy: { index: 'asc' },
      });

      const turnsPayload = turns.map((t: any) => ({
        role: t.role === 'USER' ? 'user' : 'assistant',
        content: t.content,
        turn_index: t.index,
      }));

      const scoreRes = await fetch(`${ANALYSIS_ENGINE_URL}/analyze/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          turns: turnsPayload,
          ignored_categories: ignoredCategories,
          custom_rules: customRules,
        }),
      });

      if (!scoreRes.ok) {
        const errText = await scoreRes.text();
        throw new Error(`Scoring engine returned ${scoreRes.status}: ${errText}`);
      }

      const scored = await scoreRes.json() as {
        tilt_score: number;
        tilt_grade: string;
        flagged_turns: number;
        pattern_breakdown: Record<string, number>;
        summary: string;
        turn_results?: Array<{ flagged: boolean; flags?: any[] }>;
      };

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          status: 'COMPLETED',
          tiltScore: scored.tilt_score,
          grade: scored.tilt_grade,
          endedAt,
          turnCount: turns.length,
          flagCount: scored.flagged_turns ?? 0,
        },
      });

      // Publish scoring event
      await redisConnection.publish(
        `project:${auth.projectId}:events`,
        JSON.stringify({
          type: 'conversation_scored',
          conversation_id: conversationId,
          tilt_score: scored.tilt_score,
          grade: scored.tilt_grade,
          summary: scored.summary,
          timestamp: new Date().toISOString(),
        }),
      );

      logger.info({ conversationId, tiltScore: scored.tilt_score, grade: scored.tilt_grade }, 'Conversation scored synchronously');

      return reply.send({
        conversation_id: conversationId,
        status: 'completed',
        tilt_score: scored.tilt_score,
        grade: scored.tilt_grade,
        total_turns: turns.length,
        flagged_turns: scored.flagged_turns ?? 0,
        summary: scored.summary ?? '',
        flags: [],
        ended_at: endedAt.toISOString(),
      });
    } catch (err) {
      logger.error(err, `Synchronous scoring failed for conversation ${conversationId}`);
      // Fallback: mark as completed without score, queue async
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'COMPLETED', endedAt },
      }).catch(() => {});
      await scoringQueue.add(
        'score-conversation',
        { conversation_id: conversationId, org_id: auth.orgId, project_id: auth.projectId, ended_at: endedAt.toISOString() },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: 1000 },
      );
      return reply.send({
        conversation_id: conversationId,
        status: 'scoring',
        tilt_score: null,
        grade: null,
        ended_at: endedAt.toISOString(),
      });
    }
  });
}


