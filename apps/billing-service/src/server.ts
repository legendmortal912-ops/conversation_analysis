import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './utils/logger.js';
import { checkoutRoutes } from './routes/checkout.js';
import { portalRoutes } from './routes/portal.js';
import { webhookRoutes } from './routes/webhook.js';
import { usageRoutes } from './routes/usage.js';
import { planRoutes } from './routes/plans.js';

const PORT = parseInt(process.env['PORT'] ?? '3003', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * ConvoGuard Billing Service
 * Handles Stripe integration, plan management, and usage limits.
 */
async function buildServer() {
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  });

  await app.register(checkoutRoutes, { prefix: '/checkout' });
  await app.register(portalRoutes, { prefix: '/portal' });
  await app.register(webhookRoutes, { prefix: '/webhook' });
  await app.register(usageRoutes, { prefix: '/usage' });
  await app.register(planRoutes, { prefix: '/plans' });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'billing-service',
    timestamp: new Date().toISOString(),
  }));

  return app;
}

async function main() {
  try {
    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Billing service running on http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start billing service');
    process.exit(1);
  }
}

main();

export { buildServer };
