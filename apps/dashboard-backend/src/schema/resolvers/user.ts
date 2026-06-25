import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

export const userResolvers = {
  Query: {
    me: async (_: any, __: any, context: { userId: string }) => {
      if (!context.userId) throw new Error('Unauthorized');
      return prisma.user.findUnique({ where: { id: context.userId } });
    },
  },
  Mutation: {
    inviteUser: async (_: any, { email, role }: { email: string; role: string }, context: { orgId: string; role: string }) => {
      if (context.role !== 'OWNER' && context.role !== 'ADMIN') throw new Error('Forbidden');
      
      // Stub for actual invitation logic (e.g. sending an email with a token)
      // Since this is just the backend schema representation, we'll pretend we succeed.
      return true;
    },
    removeUser: async (_: any, { userId }: { userId: string }, context: { orgId: string; role: string; userId: string }) => {
      if (context.role !== 'OWNER' && context.role !== 'ADMIN') throw new Error('Forbidden');
      if (userId === context.userId) throw new Error('Cannot remove yourself');
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.orgId !== context.orgId) throw new Error('User not found in organization');
      
      await prisma.user.delete({ where: { id: userId } });
      return true;
    },
    updateUserRole: async (_: any, { userId, role }: { userId: string; role: string }, context: { orgId: string; role: string }) => {
      if (context.role !== 'OWNER' && context.role !== 'ADMIN') throw new Error('Forbidden');
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.orgId !== context.orgId) throw new Error('User not found in organization');
      
      return prisma.user.update({
        where: { id: userId },
        data: { role: role as UserRole },
      });
    },
  },
  User: {
    organization: async (parent: any) => {
      return prisma.organization.findUnique({ where: { id: parent.orgId } });
    },
  },
};
