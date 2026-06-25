import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import { jwtMiddleware, requireRole, type JWTPayload } from '../middleware/jwt.js';
import { logger } from '../utils/logger.js';

/**
 * Model Management Routes — /models
 *
 * A "model" in ConvoGuard is a registered AI system deployment.
 * Internally it maps to the existing Project table in PostgreSQL.
 *
 * Project fields used:
 *   id            → model_id
 *   name          → model_name (display name)
 *   aiSystemName  → internal AI system identifier / environment tag
 *   orgId         → authenticated org scope
 *   alertThreshold→ TiltScore threshold (below this fires an alert)
 *   settings      → JSON blob for webhook, cohort_fields, description, status
 */
export async function modelRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // All model routes require a valid JWT
  app.addHook('preHandler', jwtMiddleware);

  // ─── Helper: parse settings JSON safely ───────────────
  function parseSettings(raw: unknown): Record<string, unknown> {
    if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
  }

  // ─── POST /models — Register a new model ──────────────
  app.post('/', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;

      const body = request.body as {
        model_name?: string;
        description?: string;
        environment?: string;
        alert_threshold?: number;
        alert_webhook_url?: string;
        cohort_fields?: string[];
      };

      if (!body.model_name) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'model_name is required',
        });
      }

      if (!body.environment) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'environment is required (e.g. "production", "staging")',
        });
      }

      const alertThreshold = body.alert_threshold ?? 60;
      if (alertThreshold < 0 || alertThreshold > 100) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'alert_threshold must be between 0 and 100',
        });
      }

      const settings = {
        description: body.description ?? '',
        alert_webhook_url: body.alert_webhook_url ?? null,
        cohort_fields: body.cohort_fields ?? [],
        status: 'active',
      };

      const project = await prisma.project.create({
        data: {
          name: body.model_name,
          aiSystemName: body.environment,
          orgId,
          alertThreshold,
          settings: settings as Prisma.InputJsonValue,
        },
      });

      logger.info({ modelId: project.id, orgId }, 'Model registered');

      return reply.status(201).send({
        model_id: project.id,
        model_name: project.name,
        environment: project.aiSystemName,
        alert_threshold: project.alertThreshold,
        status: 'active',
        created_at: project.createdAt,
      });
    },
  });

  // ─── GET /models — List all models for the org ─────────
  app.get('/', async (request: FastifyRequest) => {
    const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;

    const projects = await prisma.project.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });

    const models = await Promise.all(projects.map(async (p) => {
      const stats = await prisma.conversation.aggregate({
        where: { projectId: p.id },
        _avg: { tiltScore: true },
        _count: { id: true },
      });

      const settings = parseSettings(p.settings);
      return {
        model_id: p.id,
        model_name: p.name,
        environment: p.aiSystemName,
        alert_threshold: p.alertThreshold,
        description: settings['description'] ?? '',
        status: (settings['status'] as string) ?? 'active',
        alert_webhook_url: settings['alert_webhook_url'] ?? null,
        cohort_fields: (settings['cohort_fields'] as string[]) ?? [],
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        // Stats computed from DB
        stats: {
          total_conversations: stats._count.id,
          tilt_p50: stats._avg.tiltScore ?? null,
          pattern_rates: {},
          last_updated: new Date().toISOString(),
        },
      };
    }));

    return { models };
  });

  // ─── GET /models/:modelId — Single model detail ────────
  app.get('/:modelId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;
    const { modelId } = request.params as { modelId: string };

    const project = await prisma.project.findFirst({
      where: { id: modelId, orgId },
    });

    if (!project) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Model not found in your organization',
      });
    }

    const stats = await prisma.conversation.aggregate({
      where: { projectId: project.id },
      _avg: { tiltScore: true },
      _count: { id: true },
    });

    const settings = parseSettings(project.settings);

    return {
      model_id: project.id,
      model_name: project.name,
      environment: project.aiSystemName,
      alert_threshold: project.alertThreshold,
      description: settings['description'] ?? '',
      status: (settings['status'] as string) ?? 'active',
      alert_webhook_url: settings['alert_webhook_url'] ?? null,
      cohort_fields: (settings['cohort_fields'] as string[]) ?? [],
      created_at: project.createdAt,
      updated_at: project.updatedAt,
      stats: {
        total_conversations: stats._count.id,
        tilt_p50: stats._avg.tiltScore ?? null,
        pattern_rates: {},
        last_updated: new Date().toISOString(),
      },
    };
  });

  // ─── PATCH /models/:modelId — Update model settings ───
  app.patch('/:modelId', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;
      const { modelId } = request.params as { modelId: string };

      const body = request.body as {
        alert_threshold?: number;
        alert_webhook_url?: string;
        status?: 'active' | 'inactive';
        description?: string;
        cohort_fields?: string[];
        model_name?: string;
      };

      const existing = await prisma.project.findFirst({
        where: { id: modelId, orgId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Model not found in your organization',
        });
      }

      if (
        body.alert_threshold !== undefined &&
        (body.alert_threshold < 0 || body.alert_threshold > 100)
      ) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'alert_threshold must be between 0 and 100',
        });
      }

      const existingSettings = parseSettings(existing.settings);
      const updatedSettings: Record<string, unknown> = {
        ...existingSettings,
        ...(body.alert_webhook_url !== undefined && { alert_webhook_url: body.alert_webhook_url }),
        ...(body.status !== undefined && { status: body.status }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.cohort_fields !== undefined && { cohort_fields: body.cohort_fields }),
      };

      const updated = await prisma.project.update({
        where: { id: modelId },
        data: {
          ...(body.model_name && { name: body.model_name }),
          ...(body.alert_threshold !== undefined && { alertThreshold: body.alert_threshold }),
          settings: updatedSettings as Prisma.InputJsonValue,
        },
      });

      logger.info({ modelId, orgId }, 'Model updated');

      const settings = parseSettings(updated.settings);

      return {
        model_id: updated.id,
        model_name: updated.name,
        environment: updated.aiSystemName,
        alert_threshold: updated.alertThreshold,
        description: settings['description'] ?? '',
        status: (settings['status'] as string) ?? 'active',
        alert_webhook_url: settings['alert_webhook_url'] ?? null,
        cohort_fields: (settings['cohort_fields'] as string[]) ?? [],
        updated_at: updated.updatedAt,
      };
    },
  });

  // ─── DELETE /models/:modelId — Soft-delete (set inactive)
  app.delete('/:modelId', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;
      const { modelId } = request.params as { modelId: string };

      const existing = await prisma.project.findFirst({
        where: { id: modelId, orgId },
      });

      if (!existing) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Model not found in your organization',
        });
      }

      const existingSettings = parseSettings(existing.settings);
      const updatedSettings = { ...existingSettings, status: 'inactive' };

      await prisma.project.update({
        where: { id: modelId },
        data: { settings: updatedSettings as Prisma.InputJsonValue },
      });

      logger.info({ modelId, orgId }, 'Model deactivated');

      return { message: 'Model deactivated successfully', model_id: modelId, status: 'inactive' };
    },
  });
}
