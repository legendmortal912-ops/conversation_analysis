import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const metricsResolvers = {
  Query: {
    metrics: async (_: any, { projectId, period, dateFrom, dateTo }: { projectId: string; period: string; dateFrom?: Date; dateTo?: Date }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      return []; // Return empty for now as metricSnapshot does not exist
    },
  },
};
