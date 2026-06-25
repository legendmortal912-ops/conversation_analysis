import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { jwtMiddleware, requireRole, type JWTPayload } from '../middleware/jwt.js';
import { logger } from '../utils/logger.js';

/**
 * User management routes: role updates, remove user from org.
 */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  app.addHook('preHandler', jwtMiddleware);

  // ─── PUT /users/:id/role — Update user role ────────────
  app.put('/:id/role', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId, role: senderRole, userId: senderId } = (
        request as FastifyRequest & { user: JWTPayload }
      ).user;
      const { id: targetUserId } = request.params as { id: string };
      const body = request.body as { role: string };

      if (!body.role) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'role is required',
        });
      }

      const validRoles = ['OWNER', 'ADMIN', 'ANALYST', 'VIEWER'];
      const newRole = body.role.toUpperCase();
      if (!validRoles.includes(newRole)) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: `role must be one of: ${validRoles.join(', ')}`,
        });
      }

      // Cannot change your own role
      if (targetUserId === senderId) {
        return reply.status(400).send({
          error: 'Forbidden',
          message: 'You cannot change your own role',
        });
      }

      // Admins cannot promote to owner
      if (senderRole === 'admin' && newRole === 'OWNER') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners can promote to owner role',
        });
      }

      const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, orgId },
      });

      if (!targetUser) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found in your organization',
        });
      }

      // Cannot demote an owner unless you are also an owner
      if (targetUser.role === 'OWNER' && senderRole !== 'owner') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners can change the role of another owner',
        });
      }

      const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: { role: newRole as 'OWNER' | 'ADMIN' | 'ANALYST' | 'VIEWER' },
        select: { id: true, email: true, name: true, role: true },
      });

      logger.info(
        { targetUserId, newRole, changedBy: senderId, orgId },
        'User role updated',
      );

      return { user: updated };
    },
  });

  // ─── DELETE /users/:id — Remove user from org ──────────
  app.delete('/:id', {
    preHandler: [requireRole('owner', 'admin')],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const { orgId, userId: senderId, role: senderRole } = (
        request as FastifyRequest & { user: JWTPayload }
      ).user;
      const { id: targetUserId } = request.params as { id: string };

      if (targetUserId === senderId) {
        return reply.status(400).send({
          error: 'Forbidden',
          message: 'You cannot remove yourself from the organization',
        });
      }

      const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, orgId },
      });

      if (!targetUser) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found in your organization',
        });
      }

      if (targetUser.role === 'OWNER' && senderRole !== 'owner') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only owners can remove other owners',
        });
      }

      // Delete sessions then user
      await prisma.$transaction([
        prisma.session.deleteMany({ where: { userId: targetUserId } }),
        prisma.user.delete({ where: { id: targetUserId } }),
      ]);

      logger.info(
        { targetUserId, removedBy: senderId, orgId },
        'User removed from organization',
      );

      return { message: 'User removed from organization' };
    },
  });

  // ─── GET /users — List org members ─────────────────────
  app.get('/', async (request: FastifyRequest) => {
    const { orgId } = (request as FastifyRequest & { user: JWTPayload }).user;

    const users = await prisma.user.findMany({
      where: { orgId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const pendingInvites = await prisma.invite.findMany({
      where: { orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    });

    return { users, pendingInvites };
  });
}
