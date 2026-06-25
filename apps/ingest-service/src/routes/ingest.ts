import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { analysisQueue } from '../queue.js';
import { logger } from '../utils/logger.js';
import jwt from 'jsonwebtoken';

/**
 * TurnPayload — the body shape sent by the ConvoGuard SDK per-turn.
 * Maps directly to Section 3 of the implementation plan.
 */
interface TurnPayload {
  api_key: string;
  model_id: string;
  conversation_id: string;
  user_id: string;
  turn_index: number;
  speaker: 'ai' | 'user';
  text: string;
  timestamp: string;
  user_segment?: string;
  topic_hint?: string;
}

/**
 * Resolve the firm_id (orgId) from an api_key by hashing and querying the DB.
 * Returns null when the key is unknown or revoked.
 */
async function resolveFirmId(
  apiKey: string,
  prisma: InstanceType<typeof import('@prisma/client').PrismaClient>,
): Promise<{ firmId: string; projectId: string | null } | null> {
  const hash = createHash('sha256').update(apiKey).digest('hex');
  const key = await prisma.apiKey.findFirst({
    where: { keyHash: hash, revokedAt: null },
    select: { orgId: true, projectId: true, id: true, expiresAt: true },
  });
  if (!key) return null;

  if (key.expiresAt && key.expiresAt < new Date()) {
    return null; // Key is expired
  }

  // Update lastUsedAt in the background — non-critical
  prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {/* non-critical */});

  return { firmId: key.orgId, projectId: key.projectId };
}

/**
 * Ingest routes — the primary SDK-facing surface.
 *
 * POST /ingest/turn   — single turn, returns 202 immediately
 * POST /ingest/batch  — batch of conversations, enqueues one job per conversation
 */
export async function ingestRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // ─── POST /ingest/turn ─────────────────────────────────
  app.post('/turn', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<TurnPayload>;

    // ── Validation ───────────────────────────────────────
    if (!body.api_key) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'api_key is required',
      });
    }

    if (!body.model_id) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'model_id is required',
      });
    }

    if (!body.conversation_id) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'conversation_id is required',
      });
    }

    if (!body.user_id) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'user_id is required',
      });
    }

    if (body.turn_index === undefined || body.turn_index === null) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'turn_index is required',
      });
    }

    if (body.speaker !== 'ai' && body.speaker !== 'user') {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'speaker must be "ai" or "user"',
      });
    }

    if (!body.text) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'text is required',
      });
    }

    if (body.text.length > 10000) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'text must not exceed 10,000 characters',
      });
    }

    if (!body.timestamp) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'timestamp is required (ISO 8601)',
      });
    }

    // ── Auth: resolve firm_id from api_key ───────────────
    const auth = await resolveFirmId(body.api_key, prisma);
    if (!auth) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or revoked API key',
      });
    }

    // ── Enqueue job ──────────────────────────────────────
    const jobId = `job_${randomBytes(12).toString('hex')}`;

    await analysisQueue.add(
      'analyze-turn',
      {
        conversation_id: body.conversation_id,
        model_id: body.model_id,
        firm_id: auth.firmId,
        turns: [
          {
            turn_index: body.turn_index,
            speaker: body.speaker,
            text: body.text,
            timestamp: body.timestamp,
            user_id: body.user_id,
            user_segment: body.user_segment,
            topic_hint: body.topic_hint,
          },
        ],
      },
      { jobId },
    );

    logger.info(
      {
        jobId,
        conversationId: body.conversation_id,
        modelId: body.model_id,
        firmId: auth.firmId,
        speaker: body.speaker,
      },
      'Turn enqueued for analysis',
    );

    return reply.status(202).send({
      status: 'queued',
      job_id: jobId,
    });
  });

  // ─── POST /ingest/batch ────────────────────────────────
  /**
   * Accepts a batch of conversations. Each conversation is enqueued as a
   * single job with all its turns. Requires api_key and model_id at top level.
   *
   * Body:
   * {
   *   api_key: string;
   *   model_id: string;
   *   conversations: Array<{
   *     conversation_id: string;
   *     turns: Array<{
   *       user_id: string;
   *       turn_index: number;
   *       speaker: 'ai' | 'user';
   *       text: string;
   *       timestamp: string;
   *       user_segment?: string;
   *       topic_hint?: string;
   *     }>;
   *   }>;
   * }
   */
  app.post('/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      api_key?: string;
      model_id?: string;
      conversations?: Array<{
        conversation_id: string;
        turns: Array<{
          user_id: string;
          turn_index: number;
          speaker: 'ai' | 'user';
          text: string;
          timestamp: string;
          user_segment?: string;
          topic_hint?: string;
        }>;
      }>;
    };

    // ── Validation ───────────────────────────────────────
    if (!body.api_key) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'api_key is required',
      });
    }

    if (!body.model_id) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'model_id is required',
      });
    }

    if (!Array.isArray(body.conversations) || body.conversations.length === 0) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'conversations array is required and must not be empty',
      });
    }

    // ── Auth ─────────────────────────────────────────────
    const auth = await resolveFirmId(body.api_key, prisma);
    if (!auth) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or revoked API key',
      });
    }

    // ── Enqueue one job per conversation ─────────────────
    const batchId = `batch_${randomBytes(8).toString('hex')}`;
    let jobCount = 0;

    for (const conversation of body.conversations) {
      if (!conversation.conversation_id || !Array.isArray(conversation.turns)) {
        // Skip malformed entries silently (or could be strict — keeping lenient for batch)
        continue;
      }

      const jobId = `${batchId}_conv_${randomBytes(8).toString('hex')}`;

      await analysisQueue.add(
        'analyze-conversation',
        {
          conversation_id: conversation.conversation_id,
          model_id: body.model_id,
          firm_id: auth.firmId,
          turns: conversation.turns,
        },
        { jobId },
      );

      jobCount++;
    }

    logger.info(
      {
        batchId,
        jobCount,
        totalConversations: body.conversations.length,
        firmId: auth.firmId,
        modelId: body.model_id,
      },
      'Batch enqueued for analysis',
    );

    return reply.status(202).send({
      status: 'queued',
      job_count: jobCount,
      batch_id: batchId,
    });
  });

  // ─── POST /ingest/analyze/sync ─────────────────────────
  /**
   * SECURITY FIX (Flaw 11): Synchronous analysis endpoint for the Dashboard Playground.
   * This ensures Playground queries log UsageEvents and don't bypass quotas.
   * Authenticates via `access_token` cookie OR `api_key`.
   */
  app.post('/analyze/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      api_key?: string;
      project_id?: string;
      conversation_id: string;
      context_mode?: 'monitoring' | 'playground';
      turns: Array<{
        turn_index: number;
        role: 'ai' | 'user' | 'system';
        content: string;
      }>;
    };

    let orgId: string | null = null;
    let projectId: string | null = body.project_id || null;

    // 1. Authenticate via cookie
    const cookieStr = request.headers.cookie;
    const match = cookieStr?.match(/access_token=([^;]+)/);
    if (match && match[1]) {
      try {
        const secret = process.env['JWT_SECRET'] ?? 'dev-jwt-secret';
        const payload = jwt.verify(match[1], secret) as { orgId: string };
        orgId = payload.orgId;
      } catch (err) {
        logger.warn('Failed to verify JWT cookie in /analyze/sync');
      }
    }

    // 2. Fallback to api_key
    if (!orgId && body.api_key) {
      const auth = await resolveFirmId(body.api_key, prisma);
      if (auth) {
        orgId = auth.firmId;
        if (!projectId && auth.projectId) projectId = auth.projectId;
      }
    }

    if (!orgId) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid authentication' });
    }

    if (!body.conversation_id || !Array.isArray(body.turns) || body.turns.length === 0) {
      return reply.status(400).send({ error: 'Validation Error', message: 'Valid conversation_id and turns array are required' });
    }

    let ignoredCategories: string[] = [];
    let customRules: any[] = [];
    if (projectId) {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { customRules: { where: { isEnabled: true } } },
      });
      if (project) {
        const settings = project.settings as { ignoredCategories?: string[] };
        if (settings?.ignoredCategories) {
          ignoredCategories = settings.ignoredCategories;
        }
        customRules = project.customRules.map(r => ({
          id: r.id,
          name: r.name,
          patterns: r.patterns,
          severity: r.severity.toLowerCase(),
        }));
      }
    }

    // 3. Call the Analysis Engine synchronously
    const ENGINE_URL = process.env['ANALYSIS_ENGINE_URL'] ?? 'http://127.0.0.1:8001';
    let analysisResult;
    try {
      const res = await fetch(`${ENGINE_URL}/analyze/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: body.conversation_id,
          turns: body.turns,
          ignored_categories: ignoredCategories,
          custom_rules: customRules,
          context_mode: body.context_mode ?? 'monitoring',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Engine returned ${res.status}: ${text}`);
      }
      analysisResult = await res.json();
    } catch (err: any) {
      logger.error({ err, orgId }, 'Failed to call analysis engine synchronously');
      return reply.status(500).send({ error: 'Engine Error', message: err.message });
    }

    // 4. Log UsageEvent for quota management
    try {
      await prisma.$transaction([
        prisma.usageEvent.create({
          data: {
            orgId,
            projectId: projectId || null,
            eventType: 'CONVERSATION_CREATED',
            quantity: 1,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
        prisma.usageEvent.create({
          data: {
            orgId,
            projectId: projectId || null,
            eventType: 'TURN_PROCESSED',
            quantity: body.turns.length,
            periodStart: new Date(),
            periodEnd: new Date(),
          },
        }),
      ]);
    } catch (err) {
      logger.error(err, 'Failed to log usage events for /analyze/sync');
      // Non-fatal, we still return the analysis result
    }

    return reply.status(200).send(analysisResult);
  });
}
