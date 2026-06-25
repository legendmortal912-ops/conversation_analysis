import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PLANS } from '@convoguard/shared';

export async function planRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Return all available plans
    return reply.send({
      plans: Object.entries(PLANS).map(([id, plan]) => ({
        id,
        ...plan,
      })),
    });
  });
}
