import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './utils/logger.js';
import { initWorkers } from './workers/index.js';

const PORT = parseInt(process.env['PORT'] ?? '3004', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * ConvoGuard Alert Service
 * Evaluates triggers and delivers alerts via Email, Slack, and Webhooks.
 */
async function buildServer() {
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
  });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'alert-service',
    timestamp: new Date().toISOString(),
  }));

  return app;
}

async function main() {
  try {
    await initWorkers();
    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Alert service running on http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start alert service');
    process.exit(1);
  }
}

main();

export { buildServer };
