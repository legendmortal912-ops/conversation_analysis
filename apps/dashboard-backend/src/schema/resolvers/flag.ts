import { PrismaClient, ReviewVerdict } from '@prisma/client';
import { pubsub, TRIGGERS } from '../../subscriptions/pubsub.js';

const prisma = new PrismaClient();

export const flagResolvers = {
  Query: {
    flags: async (_: any, { projectId, limit = 50 }: { projectId: string; limit?: number }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      return prisma.flag.findMany({
        where: {
          conversation: { projectId },
        },
        orderBy: { turn: { createdAt: 'desc' } },
        take: limit,
      });
    },
  },
  Mutation: {
    markFlagFalsePositive: async (_: any, { flagId, isFalsePositive, comment }: { flagId: string; isFalsePositive: boolean; comment?: string }, context: { orgId: string; userId: string }) => {
      const flag = await prisma.flag.findUnique({ 
        where: { id: flagId },
        include: { conversation: { include: { project: true } } },
      });

      if (!flag || flag.conversation.project.orgId !== context.orgId) {
        throw new Error('Not found or unauthorized');
      }

      const verdict: ReviewVerdict = isFalsePositive ? 'DISMISSED' : 'CONFIRMED';
      
      await prisma.flagReview.create({
        data: {
          flagId,
          reviewerId: context.userId,
          verdict,
          notes: comment,
        }
      });

      // Update flag status - simplified
      const updatedFlag = await prisma.flag.findUnique({ where: { id: flagId } });
      
      return updatedFlag;
    },
  },
  Flag: {
    review: async (parent: any) => {
      return prisma.flagReview.findFirst({ where: { flagId: parent.id }, orderBy: { createdAt: 'desc' } });
    },
  },
};
