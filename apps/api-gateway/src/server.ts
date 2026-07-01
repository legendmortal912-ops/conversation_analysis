import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import proxy from '@fastify/http-proxy';
import { verifyRoutes } from './routes/verify.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

/**
 * ConvoGuard API Gateway
 * Public-facing entry point that proxies requests to internal microservices.
 * Handles rate limiting, CORS, and exposes the public verification API.
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    // SECURITY FIX (Flaw 15): Always anchor the rate-limit bucket to the real
    // client IP. Previously, using only the API key as the bucket key allowed
    // an attacker to bypass the limiter by rotating fake/random x-api-key
    // headers on every request (each fake key = fresh 200 req/min bucket).
    //
    // New strategy: the bucket key is always IP-prefixed. Authenticated
    // requests use "<ip>:<token>" so per-user limits still apply; anonymous
    // requests use the IP alone. A single IP can never exceed 200 req/min
    // regardless of how many different API keys it presents.
    keyGenerator: (request) => {
      const ip = request.ip;

      // Prefer the explicit API key (SDK callers)
      const apiKey = request.headers['x-api-key'] as string | undefined;
      if (apiKey) return `${ip}:${apiKey}`;

      // Fall back to Bearer JWT (dashboard callers)
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        return `${ip}:${authHeader.substring(7)}`;
      }

      // Cookie-based auth (httpOnly cookie flow)
      if (request.headers.cookie?.includes('access_token=')) {
        const cookie = request.headers.cookie
          .split(';')
          .find((c) => c.trim().startsWith('access_token='));
        if (cookie) return `${ip}:${cookie.split('=')[1]}`;
      }

      // Unauthenticated — IP only
      return ip;
    },
  });

  // ─── Service Proxies ──────────────────────────────────
  const INGEST_URL = process.env['INGEST_SERVICE_URL'] ?? 'http://127.0.0.1:3001';
  const AUTH_URL = process.env['AUTH_SERVICE_URL'] ?? 'http://127.0.0.1:3002';
  const BILLING_URL = process.env['BILLING_SERVICE_URL'] ?? 'http://localhost:3003';
  const ALERT_URL = process.env['ALERT_SERVICE_URL'] ?? 'http://localhost:3004';
  const DASHBOARD_URL = process.env['DASHBOARD_BACKEND_URL'] ?? 'http://localhost:3005';
  const LICENSE_URL = process.env['LICENSE_SERVICE_URL'] ?? 'http://localhost:3006';
  const ANALYSIS_URL = process.env['ANALYSIS_ENGINE_URL'] ?? 'http://127.0.0.1:8001';

  // Proxy: /v1/conversations, /v1/batch, /v1/ws → ingest-service
  await app.register(proxy, {
    upstream: INGEST_URL,
    prefix: '/v1/conversations',
    rewritePrefix: '/v1/conversations',
    websocket: true,
  });

  await app.register(proxy, {
    upstream: INGEST_URL,
    prefix: '/v1/batch',
    rewritePrefix: '/v1/batch',
  });

  await app.register(proxy, {
    upstream: INGEST_URL,
    prefix: '/v1/ws',
    rewritePrefix: '/v1/ws',
    websocket: true,
  });

  // Proxy: /ingest/turn, /ingest/batch → ingest-service (SDK-facing)
  await app.register(proxy, {
    upstream: INGEST_URL,
    prefix: '/ingest',
    rewritePrefix: '/ingest',
  });

  // Proxy: /auth → auth-service
  await app.register(proxy, {
    upstream: AUTH_URL,
    prefix: '/auth',
    rewritePrefix: '/auth',
  });

  // Proxy: /api-keys → auth-service
  await app.register(proxy, {
    upstream: AUTH_URL,
    prefix: '/api-keys',
    rewritePrefix: '/api-keys',
  });

  // Proxy: /users → auth-service
  await app.register(proxy, {
    upstream: AUTH_URL,
    prefix: '/users',
    rewritePrefix: '/users',
  });

  // Proxy: /models → auth-service (model/project management)
  await app.register(proxy, {
    upstream: AUTH_URL,
    prefix: '/models',
    rewritePrefix: '/models',
  });

  // Proxy: /billing → billing-service
  await app.register(proxy, {
    upstream: BILLING_URL,
    prefix: '/billing',
    rewritePrefix: '/billing',
  });

  // Proxy: /graphql → dashboard-backend
  await app.register(proxy, {
    upstream: DASHBOARD_URL,
    prefix: '/graphql',
    rewritePrefix: '/graphql',
    websocket: true,
  });

  // Proxy: /v1/license → license-service
  await app.register(proxy, {
    upstream: LICENSE_URL,
    prefix: '/v1/license',
    rewritePrefix: '/license',
  });

  // Proxy: /fetch/url → analysis-engine
  await app.register(proxy, {
    upstream: ANALYSIS_URL,
    prefix: '/fetch/url',
    rewritePrefix: '/fetch/url',
  });

  // ─── Public Verification API (no auth) ─────────────────
  await app.register(verifyRoutes, { prefix: '/v1' });

  // ─── Public Signing Key ────────────────────────────────
  app.get('/v1/public/signing-key', async () => ({
    algorithm: 'Ed25519',
    public_key: process.env['SIGNING_PUBLIC_KEY'] ?? '',
    format: 'hex',
    purpose: 'Merkle checkpoint signature verification',
    documentation: 'https://docs.convoguard.dev/verification',
  }));

  // ─── Health Check ──────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  // ─── Service Health Aggregation ────────────────────────
  app.get('/health/services', async () => {
    const services = [
      { name: 'ingest', url: INGEST_URL },
      { name: 'auth', url: AUTH_URL },
      { name: 'billing', url: BILLING_URL },
      { name: 'alert', url: ALERT_URL },
      { name: 'dashboard', url: DASHBOARD_URL },
    ];

    const results = await Promise.allSettled(
      services.map(async (svc) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
          const res = await fetch(`${svc.url}/health`, { signal: controller.signal });
          return { name: svc.name, status: res.ok ? 'healthy' : 'unhealthy' };
        } catch {
          return { name: svc.name, status: 'unreachable' };
        } finally {
          clearTimeout(timeout);
        }
      }),
    );

    return {
      services: results.map((r) =>
        r.status === 'fulfilled' ? r.value : { name: 'unknown', status: 'error' },
      ),
      timestamp: new Date().toISOString(),
    };
  });

  return app;
}

async function main() {
  try {
    const app = await buildServer();
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`API Gateway running on http://${HOST}:${PORT}`);
  } catch (err) {
    console.error('Failed to start API Gateway:', err);
    process.exit(1);
  }
}

main();

export { buildServer };
