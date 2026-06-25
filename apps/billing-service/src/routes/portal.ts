import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripe } from '../services/stripe.js';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function decodeToken(token: string): { orgId: string; userId: string; role: string } | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    return JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
  } catch {
    return null;
  }
}

export async function portalRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = decodeToken(authHeader.substring(7));
    if (!token || (token.role !== 'owner' && token.role !== 'admin')) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners and admins can manage billing' });
    }

    const org = await prisma.organization.findUnique({ where: { id: token.orgId } });
    if (!org) return reply.status(404).send({ error: 'Organization not found' });

    if (!org.stripeCustomerId) {
      return reply.status(400).send({ error: 'Organization has no active Stripe customer profile' });
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${process.env['FRONTEND_URL']}/settings/billing`,
      });

      logger.info({ orgId: org.id }, 'Billing portal session created');
      return { url: session.url };
    } catch (err) {
      logger.error(err, 'Failed to create billing portal session');
      return reply.status(500).send({ error: 'Failed to create portal session' });
    }
  });
}
