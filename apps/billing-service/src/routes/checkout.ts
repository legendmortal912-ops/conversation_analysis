import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripe } from '../services/stripe.js';
import { PLANS } from '@convoguard/shared';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Minimal JWT verify function to decode the bearer token
function decodeToken(token: string): { orgId: string; userId: string; role: string } | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    return JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
  } catch {
    return null;
  }
}

export async function checkoutRoutes(app: FastifyInstance): Promise<void> {
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = decodeToken(authHeader.substring(7));
    if (!token || (token.role !== 'owner' && token.role !== 'admin')) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only owners and admins can upgrade plans' });
    }

    const body = request.body as { planId: string };
    if (!body.planId || !['STARTER', 'GROWTH', 'ENTERPRISE'].includes(body.planId)) {
      return reply.status(400).send({ error: 'Invalid planId' });
    }

    const org = await prisma.organization.findUnique({ where: { id: token.orgId } });
    if (!org) return reply.status(404).send({ error: 'Organization not found' });

    const plan = PLANS[body.planId as keyof typeof PLANS];
    if (!plan.stripePriceId) {
      return reply.status(400).send({ error: 'Plan cannot be purchased via self-serve' });
    }

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env['FRONTEND_URL']}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env['FRONTEND_URL']}/settings/billing?canceled=true`,
        client_reference_id: org.id,
        customer_email: org.stripeCustomerId ? undefined : undefined,
        customer: org.stripeCustomerId ?? undefined,
        metadata: { orgId: org.id, planId: body.planId },
        subscription_data: {
          metadata: { orgId: org.id, planId: body.planId },
        },
      });

      logger.info({ orgId: org.id, planId: body.planId }, 'Checkout session created');
      return { url: session.url };
    } catch (err) {
      logger.error(err, 'Failed to create checkout session');
      return reply.status(500).send({ error: 'Failed to create checkout session' });
    }
  });
}
