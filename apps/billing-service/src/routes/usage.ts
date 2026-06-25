import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUsage } from '../services/metering.js';
import { logger } from '../utils/logger.js';

function decodeToken(token: string): { orgId: string; userId: string; role: string } | null {
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    return JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
  } catch {
    return null;
  }
}

export async function usageRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const token = decodeToken(authHeader.substring(7));
    if (!token) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    try {
      const usage = await getUsage(token.orgId);
      return usage;
    } catch (err) {
      logger.error(err, 'Failed to get usage');
      return reply.status(500).send({ error: 'Failed to retrieve usage data' });
    }
  });
}
