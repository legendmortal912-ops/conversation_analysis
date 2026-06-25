import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jwtMiddleware, requireRole, type JWTPayload } from '../middleware/jwt.js';
import { generateApiKey, hashApiKey } from '../middleware/api-key.js';
import { logger } from '../utils/logger.js';

/**
 * API Key management routes.
 * Keys are generated as cg_live_<random>, stored as SHA-256 hashes,
 * and the full key is shown only once at creation time.
 */
export async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // All routes require JWT auth
  app.addHook('preHandler', jwtMiddleware);

  // ─── POST /api-keys — Create new API key ───────────────
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId, orgId } = (request as FastifyRequest & { user: JWTPayload }).user;
      const body = request.body as { name: string; projectId?: string; expiresInDays?: number };

      if (!body.name) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'name is required for the API key',
        });
      }

      // Verify project belongs to org if specified
      if (body.projectId) {
        const project = await prisma.project.findFirst({
          where: { id: body.projectId, orgId },
        });
        if (!project) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Project not found in your organization',
          });
        }
      }

      const { key, prefix, hash } = generateApiKey();
      
      let expiresAt: Date | undefined;
      if (body.expiresInDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + body.expiresInDays);
      }

      const apiKey = await prisma.apiKey.create({
        data: {
          keyHash: hash,
          keyPrefix: prefix,
          name: body.name,
          orgId,
          projectId: body.projectId ?? null,
          createdById: userId,
          expiresAt: expiresAt ?? null,
        },
      });

      logger.info({ keyId: apiKey.id, orgId }, 'API key created');

      return reply.status(201).send({
        id: apiKey.id,
        key, // ⚠️ Shown only once — store it securely!
        prefix: apiKey.keyPrefix,
        name: apiKey.name,
        projectId: apiKey.projectId,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
        message: 'Save this key now — it will not be shown again.',
      });
    },
  });

  // ─── GET /api-keys — List org API keys ─────────────────
  app.get('/', async (request: FastifyRequest) => {
    const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;

    const keys = await prisma.apiKey.findMany({
      where: { orgId },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        projectId: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { keys };
  });

  // ─── DELETE /api-keys/:id — Revoke API key ─────────────
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;
      const { id } = request.params as { id: string };

      const key = await prisma.apiKey.findFirst({
        where: { id, orgId },
      });

      if (!key) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'API key not found',
        });
      }

      if (key.revokedAt) {
        return reply.status(400).send({
          error: 'Already Revoked',
          message: 'This API key has already been revoked',
        });
      }

      await prisma.apiKey.update({
        where: { id },
        data: { revokedAt: new Date() },
      });

      logger.info({ keyId: id, orgId }, 'API key revoked');

      return { message: 'API key revoked successfully' };
    },
  });
}
