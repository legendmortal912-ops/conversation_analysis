import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './routes/auth.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { userRoutes } from './routes/users.js';
import { modelRoutes } from './routes/models.js';
import { onboardRoutes } from './routes/onboard.js';
import { logger } from './utils/logger.js';
import oauthPlugin from '@fastify/oauth2';

const PORT = parseInt(process.env['PORT'] ?? '3002', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * ConvoGuard Auth Service
 * Handles JWT authentication, API key management, organization/user management,
 * invite flows, and role-based access control.
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
  });

  // ─── Plugins ───────────────────────────────────────────
  await app.register(cors, {
    origin: process.env['FRONTEND_URL'] ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(cookie, {
    secret: process.env['COOKIE_SECRET'] ?? 'convoguard-cookie-secret',
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
  });

  const backendUrl = process.env['BACKEND_URL'] ?? `http://${HOST}:${PORT}`;

  await app.register(oauthPlugin, {
    name: 'googleOAuth2',
    scope: ['profile', 'email'],
    credentials: {
      client: {
        id: process.env['GOOGLE_CLIENT_ID'] ?? '',
        secret: process.env['GOOGLE_CLIENT_SECRET'] ?? ''
      },
      auth: (oauthPlugin as any).GOOGLE_CONFIGURATION
    },
    startRedirectPath: '/auth/google/login',
    callbackUri: `${backendUrl}/auth/google/callback`
  });

  await app.register(oauthPlugin, {
    name: 'githubOAuth2',
    scope: ['user:email'],
    credentials: {
      client: {
        id: process.env['GITHUB_CLIENT_ID'] ?? '',
        secret: process.env['GITHUB_CLIENT_SECRET'] ?? ''
      },
      auth: (oauthPlugin as any).GITHUB_CONFIGURATION
    },
    startRedirectPath: '/auth/github/login',
    callbackUri: `${backendUrl}/auth/github/callback`
  });

  // ─── Routes ────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(onboardRoutes, { prefix: '/auth' });
  await app.register(apiKeyRoutes, { prefix: '/api-keys' });
  await app.register(userRoutes, { prefix: '/users' });
  await app.register(modelRoutes, { prefix: '/models' });

  // ─── Health Check ──────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
  }));

  return app;
}

async function main() {
  try {
    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    logger.info(`Auth service running on http://${HOST}:${PORT}`);
  } catch (err) {
    logger.error(err, 'Failed to start auth service');
    process.exit(1);
  }
}

main();

export { buildServer };
