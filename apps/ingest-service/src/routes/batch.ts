import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { scrubPII } from '../middleware/pii-scrubber.js';

const redisConnection = new IORedis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const analysisQueue = new Queue('analysis', { connection: redisConnection });

/**
 * Batch ingestion route for bulk conversation import.
 */
export async function batchRoutes(app: FastifyInstance): Promise<void> {
  // ─── POST /v1/batch — Bulk import conversations ───────
  app.post('/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    let isAuthenticated = false;
    let orgId: string | null = null;
    
    const jwtToken = request.headers['authorization']?.startsWith('Bearer eyJ')
      ? request.headers['authorization'].slice(7)
      : undefined;

    const apiKey =
      (request.headers['x-api-key'] as string | undefined) ??
      (request.headers['authorization']?.startsWith('Bearer cg_')
        ? request.headers['authorization'].slice(7)
        : undefined);

    if (jwtToken) {
      try {
        const jwt = await import('jsonwebtoken');
        const secret = process.env.JWT_SECRET ?? 'dev-jwt-secret';
        const payload = jwt.default.verify(jwtToken, secret) as any;
        orgId = payload.orgId;
        isAuthenticated = true;
      } catch (err) {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired JWT' });
      }
    } else if (apiKey) {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const hash = createHash('sha256').update(apiKey).digest('hex');
      const key = await prisma.apiKey.findFirst({
        where: { keyHash: hash, revokedAt: null },
      });

      if (key && (!key.expiresAt || key.expiresAt >= new Date())) {
        orgId = key.orgId;
        isAuthenticated = true;
        prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      } else {
        return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired API key' });
      }
    }

    if (!isAuthenticated) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key required. Provide via X-API-Key header or Authorization: Bearer cg_...',
      });
    }

    const body = request.body as {
      conversations: Array<{
        external_id?: string;
        project_id?: string;
        turns: Array<{
          speaker: 'user' | 'ai';
          content: string;
          timestamp?: string;
        }>;
      }>;
    };

    if (!body.conversations || !Array.isArray(body.conversations)) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'conversations array is required',
      });
    }

    const batchId = `batch_${randomBytes(8).toString('hex')}`;
    let queuedCount = 0;

    for (const conversation of body.conversations) {
      const conversationId = `conv_${randomBytes(12).toString('hex')}`;

      for (const turn of conversation.turns) {
        if (turn.speaker === 'ai') {
          const { scrubbed } = scrubPII(turn.content);

          await analysisQueue.add(
            'analyze-turn',
            {
              batch_id: batchId,
              conversation_id: conversationId,
              turn_id: `turn_${randomBytes(12).toString('hex')}`,
              ai_content: scrubbed,
              original_content: turn.content,
              timestamp: turn.timestamp ?? new Date().toISOString(),
              org_id: orgId,
              project_id: conversation.project_id,
              pii_detected: false,
            },
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 1000 },
              removeOnComplete: 1000,
            },
          );
          queuedCount++;
        }
      }
    }

    logger.info(
      { batchId, conversations: body.conversations.length, queuedTurns: queuedCount },
      'Batch import queued',
    );

    return reply.status(202).send({
      batch_id: batchId,
      conversations_count: body.conversations.length,
      queued_count: queuedCount,
      status: 'processing',
    });
  });
}

