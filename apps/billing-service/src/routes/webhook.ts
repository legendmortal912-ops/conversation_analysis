import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { stripe } from '../services/stripe.js';
import { logger } from '../utils/logger.js';
import { PrismaClient } from '@prisma/client';
import type Stripe from 'stripe';
import { PLANS } from '@convoguard/shared/constants/plans';

const prisma = new PrismaClient();

/**
 * SECURITY FIX (Flaw 14): Map Stripe price IDs to our internal plan enum.
 *
 * Built dynamically from the canonical PLANS constant so that adding a new
 * plan in plans.ts is the only change needed — no duplicate mappings here.
 *
 * Enterprise plans intentionally have no stripePriceId (custom contracts),
 * so they must be set manually by an admin after the Stripe checkout.
 */
const PRICE_TO_PLAN: Record<string, string> = Object.fromEntries(
  Object.values(PLANS)
    .filter((p) => p.stripePriceId)
    .map((p) => [p.stripePriceId!, p.id]),
);

/**
 * Resolve a Stripe Subscription object to our internal plan ID.
 * Reads the price ID from the first subscription item (the billing line).
 * Falls back to STARTER if the price is unrecognised (e.g. legacy prices).
 */
function resolvePlanFromSubscription(sub: Stripe.Subscription): string {
  const priceId = sub.items?.data?.[0]?.price?.id;
  if (priceId && PRICE_TO_PLAN[priceId]) {
    return PRICE_TO_PLAN[priceId];
  }
  // Unknown price — log a warning so we can update the mapping.
  logger.warn({ priceId }, 'Unknown Stripe price ID — defaulting to STARTER');
  return 'STARTER';
}

export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Stripe requires the raw body for signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    done(null, body);
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'];
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    const isMockMode = process.env['STRIPE_SECRET_KEY']?.startsWith('sk_test_mock');

    if (!sig || !webhookSecret) {
      if (!isMockMode) {
        return reply.status(400).send({ error: 'Missing stripe-signature or secret' });
      }
    }

    let event: Stripe.Event;

    try {
      if (isMockMode) {
        event = JSON.parse((request.body as Buffer).toString()) as Stripe.Event;
      } else {
        event = stripe.webhooks.constructEvent(request.body as Buffer, sig as string, webhookSecret!);
      }
    } catch (err) {
      logger.error(err, 'Stripe webhook signature verification failed');
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const orgId = session.client_reference_id;

          if (orgId) {
            // SECURITY FIX (Flaw 14): Resolve the real plan from the Stripe
            // subscription's price ID rather than trusting session.metadata
            // (which was previously hardcoded to STARTER on the frontend).
            let planId = 'STARTER';
            if (session.subscription) {
              const sub = await stripe.subscriptions.retrieve(
                session.subscription as string,
                { expand: ['items.data.price'] },
              );
              planId = resolvePlanFromSubscription(sub);
            } else if (session.metadata?.planId) {
              // Honour explicit metadata as a last resort (e.g. manual overrides)
              planId = session.metadata.planId;
            }

            await prisma.organization.update({
              where: { id: orgId },
              data: {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                plan: planId as any,
              },
            });
            logger.info(
              { orgId, customerId: session.customer, planId },
              'Checkout completed — org upgraded to correct plan',
            );
          }
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const orgId = sub.metadata['orgId'];
          if (orgId) {
            if (sub.status === 'canceled' || sub.status === 'incomplete_expired') {
              // Subscription was cancelled — downgrade to FREE
              await prisma.organization.update({
                where: { id: orgId },
                data: { plan: 'FREE' },
              });
              logger.info({ orgId }, 'Subscription cancelled — downgraded to FREE');
            } else if (sub.status === 'active' || sub.status === 'trialing') {
              // Plan may have changed (upgrade / downgrade) — re-resolve from price ID
              const planId = resolvePlanFromSubscription(sub);
              await prisma.organization.update({
                where: { id: orgId },
                data: { plan: planId as any },
              });
              logger.info({ orgId, planId, status: sub.status }, 'Subscription updated — plan synced');
            } else {
              logger.info({ orgId, status: sub.status }, 'Subscription status changed (no plan action taken)');
            }
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          const orgId = sub.metadata['orgId'];
          if (orgId) {
            await prisma.organization.update({
              where: { id: orgId },
              data: { plan: 'FREE', stripeSubscriptionId: null },
            });
            logger.info({ orgId }, 'Subscription deleted, downgraded to FREE');
          }
          break;
        }
      }

      return { received: true };
    } catch (err) {
      logger.error(err, 'Error processing Stripe webhook');
      return reply.status(500).send({ error: 'Webhook handler failed' });
    }
  });
}
