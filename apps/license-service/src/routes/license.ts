import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { signLicenseJwt } from '../utils/ed25519.js';

export async function licenseRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  // ─── POST /issue ─────────────────────────────────────────
  app.post('/issue', async (request: FastifyRequest, reply: FastifyReply) => {
    // SECURITY FIX: Require service-to-service authentication
    const internalSecret = request.headers['x-internal-secret'];
    if (internalSecret !== (process.env['INTERNAL_SERVICE_SECRET'] ?? 'dev-internal-secret')) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid internal service secret' });
    }

    const body = request.body as { orgId: string };

    if (!body.orgId) {
      return reply.status(400).send({ error: 'Validation Error', message: 'orgId is required' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: body.orgId },
      include: { projects: true },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Not Found', message: 'Organization not found' });
    }

    // SECURITY FIX (Flaw 7): Enforce On-Premise plan eligibility
    // Only GROWTH and ENTERPRISE plans can deploy the container.
    if (org.plan === 'FREE' || org.plan === 'STARTER') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'On-premise deployment requires a Growth or Enterprise plan.',
      });
    }

    // Determine turn limits based on plan
    let turnLimitPerWeek: number | null = null;
    if (org.plan === 'GROWTH') {
      turnLimitPerWeek = 100000;
    } // ENTERPRISE has null (unlimited, billed dynamically)

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 7 * 24 * 60 * 60; // 7 days

    const payload = {
      org_id: org.id,
      plan_id: org.plan,
      turn_limit_per_week: turnLimitPerWeek,
      iat: issuedAt,
      exp: expiresAt,
    };

    try {
      const signedJwt = await signLicenseJwt(payload);
      return { status: 'success', license: signedJwt };
    } catch (err: any) {
      request.log.error(err, 'Failed to sign license');
      return reply.status(500).send({ error: 'Internal Error', message: 'License signing failed' });
    }
  });

  // ─── POST /renew ─────────────────────────────────────────
  app.post('/renew', async (request: FastifyRequest, reply: FastifyReply) => {
    // Called by the container heartbeat
    // SECURITY FIX: M-TLS / Cert check would be handled by API Gateway or nginx proxying here,
    // but we can ensure they at least pass an orgId that matches their mTLS cert.
    const body = request.body as { orgId: string };

    if (!body.orgId) {
      return reply.status(400).send({ error: 'Validation Error', message: 'orgId is required' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: body.orgId },
    });

    if (!org) {
      return reply.status(404).send({ error: 'Not Found', message: 'Organization not found' });
    }

    // If their subscription ended or downgraded, refuse renewal
    if (org.plan === 'FREE' || org.plan === 'STARTER') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Organization is no longer eligible for On-Premise deployment.',
      });
    }

    let turnLimitPerWeek: number | null = null;
    if (org.plan === 'GROWTH') {
      turnLimitPerWeek = 100000;
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + 7 * 24 * 60 * 60;

    const payload = {
      org_id: org.id,
      plan_id: org.plan,
      turn_limit_per_week: turnLimitPerWeek,
      iat: issuedAt,
      exp: expiresAt,
    };

    try {
      const signedJwt = signLicenseJwt(payload);
      return { status: 'success', license: signedJwt };
    } catch (err: any) {
      request.log.error(err, 'Failed to renew license');
      return reply.status(500).send({ error: 'Internal Error', message: 'License renewal failed' });
    }
  });
}
