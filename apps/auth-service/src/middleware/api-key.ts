import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * API Key validation middleware.
 * Accepts keys via Authorization header (Bearer) or X-API-Key header.
 * Keys are stored as SHA-256 hashes in the database — the full key
 * is shown only once at creation time.
 */

/** Hash an API key for storage comparison */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Generate a new API key with prefix for identification */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = 'cg_live';
  const secret = randomBytes(32).toString('hex');
  const key = `${prefix}_${secret}`;
  const hash = hashApiKey(key);
  return { key, prefix, hash };
}

/**
 * Middleware that validates API keys from request headers.
 * Attaches resolved project and org info to the request.
 */
export function apiKeyMiddleware(
  /** Function to look up an API key hash in the database */
  lookupKeyHash: (hash: string) => Promise<{
    id: string;
    orgId: string;
    projectId: string | null;
    revokedAt: Date | null;
  } | null>,
) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const apiKey =
      request.headers['x-api-key'] as string |
      undefined ??
      (request.headers['authorization']?.startsWith('Bearer cg_')
        ? request.headers['authorization'].slice(7)
        : undefined);

    if (!apiKey) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key required. Provide via X-API-Key header or Authorization: Bearer cg_...',
      });
    }

    const hash = hashApiKey(apiKey);
    const keyRecord = await lookupKeyHash(hash);

    if (!keyRecord) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    }

    if (keyRecord.revokedAt) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'API key has been revoked',
      });
    }

    // Attach API key context to request
    (request as FastifyRequest & { apiKeyContext: typeof keyRecord }).apiKeyContext = keyRecord;
  };
}
