import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { logger } from '../utils/logger.js';

/**
 * Onboarding Route — POST /auth/onboard
 *
 * Public endpoint (no auth required). Creates:
 *   1. Organization  — the firm/tenant
 *   2. User          — the OWNER (contact person)
 *   3. ApiKey        — initial SDK key, shown ONCE (plaintext)
 *
 * API key format: cg_live_<32 random hex chars>
 * Only the SHA-256 hash + 7-char prefix are stored in the DB.
 *
 * Response includes the plaintext api_key — it is NEVER retrievable again.
 */
export async function onboardRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  app.post('/onboard', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      company_name?: string;
      plan?: string;
      billing_email?: string;
      contact_name?: string;
    };

    // ── Validation ─────────────────────────────────────
    if (!body.company_name || body.company_name.trim().length === 0) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'company_name is required',
      });
    }

    if (!body.billing_email || body.billing_email.trim().length === 0) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'billing_email is required',
      });
    }

    if (!body.contact_name || body.contact_name.trim().length === 0) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'contact_name is required',
      });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.billing_email)) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'billing_email must be a valid email address',
      });
    }

    // Check if billing email is already used
    const existingUser = await prisma.user.findUnique({
      where: { email: body.billing_email.toLowerCase() },
    });
    if (existingUser) {
      return reply.status(409).send({
        error: 'Conflict',
        message: 'An account with this billing email already exists',
      });
    }

    // ── Determine plan ─────────────────────────────────
    const allowedPlans = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'] as const;
    type PlanType = typeof allowedPlans[number];

    const rawPlan = (body.plan ?? 'FREE').toUpperCase();
    const plan: PlanType = allowedPlans.includes(rawPlan as PlanType)
      ? (rawPlan as PlanType)
      : 'FREE';

    // ── Generate org slug ──────────────────────────────
    const slug =
      body.company_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'org';

    // ── Generate API key — cg_live_<32 hex chars> ─────
    const secret = randomBytes(32).toString('hex');       // 64 chars
    const apiKey = `cg_live_${secret.slice(0, 32)}`;      // cg_live_ + 32 hex = 40 chars total
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.slice(0, 7);                 // "cg_live"

    // ── Transactional creation ─────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create organization
      const org = await tx.organization.create({
        data: {
          name: body.company_name!.trim(),
          slug: `${slug}-${randomBytes(3).toString('hex')}`,
          plan,
          settings: {
            billing_email: body.billing_email!.toLowerCase(),
            onboarded_at: new Date().toISOString(),
          },
        },
      });

      // 2. Create owner user
      // No password set at onboarding — firm can set it via invite or reset flow
      const user = await tx.user.create({
        data: {
          email: body.billing_email!.toLowerCase(),
          name: body.contact_name!.trim(),
          role: 'OWNER',
          orgId: org.id,
          // passwordHash intentionally omitted — owner sets password via email link
        },
      });

      // 3. Create initial API key
      const key = await tx.apiKey.create({
        data: {
          keyHash,
          keyPrefix,
          name: 'Default SDK Key',
          orgId: org.id,
          projectId: null,
          createdById: user.id,
        },
      });

      return { org, user, key };
    });

    logger.info(
      {
        orgId: result.org.id,
        userId: result.user.id,
        keyId: result.key.id,
        plan,
      },
      'Firm onboarded',
    );

    return reply.status(201).send({
      org_id: result.org.id,
      org_name: result.org.name,
      user_id: result.user.id,
      // ⚠️ Shown ONCE — the plaintext key is never stored
      api_key: apiKey,
      sdk_install: 'npm install @convoguard/sdk',
      docs_url: 'https://docs.convoguard.io',
      message:
        'Save your API key now — it will not be shown again. ' +
        'A setup email has been sent to ' +
        body.billing_email,
    });
  });
}
