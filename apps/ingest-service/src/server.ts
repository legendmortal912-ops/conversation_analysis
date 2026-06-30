import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { conversationRoutes } from './routes/conversations.js';
import { batchRoutes } from './routes/batch.js';
import { websocketRoutes } from './routes/websocket.js';
import { ingestRoutes } from './routes/ingest.js';
import { initWorkers } from './workers/index.js';
import { logger } from './utils/logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * ConvoGuard Ingest Service
 * Receives conversation data via REST and WebSocket,
 * queues analysis jobs, and streams real-time results.
 */
async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    bodyLimit: 50 * 1024 * 1024, // 50MB
  });

  // ─── Plugins ───────────────────────────────────────────
  await app.register(cors, {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(websocket);

  // ─── Routes ────────────────────────────────────────────
  await app.register(conversationRoutes, { prefix: '/v1' });
  await app.register(batchRoutes, { prefix: '/v1' });
  await app.register(websocketRoutes, { prefix: '/v1/ws' });
  await app.register(ingestRoutes, { prefix: '/ingest' });

  // ─── Health Check ──────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    service: 'ingest-service',
    timestamp: new Date().toISOString(),
  }));

  return app;
}

async function main() {
  try {
    console.log("====== REDIS_URL IS:", process.env['REDIS_URL'], "======");
    // Initialize BullMQ workers
    await initWorkers();
    logger.info('BullMQ workers initialized');

    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Ingest service running on http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start ingest service');
    process.exit(1);
  }
}

main();

export { buildServer };
