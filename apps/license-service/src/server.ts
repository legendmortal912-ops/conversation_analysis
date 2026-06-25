import Fastify from 'fastify';
import cors from '@fastify/cors';
import { licenseRoutes } from './routes/license.js';
import { modelVersionRoutes } from './routes/model-versions.js';

const PORT = parseInt(process.env['PORT'] ?? '3006', 10); // Use 3006 for license service
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  await app.register(cors, {
    origin: '*',
  });

  await app.register(licenseRoutes, { prefix: '/license' });
  await app.register(modelVersionRoutes, { prefix: '/models' });

  app.get('/health', async () => ({ status: 'ok', service: 'license-service' }));

  return app;
}

async function main() {
  try {
    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`License Service running on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start License Service:', err);
    process.exit(1);
  }
}

main();

export { buildServer };
