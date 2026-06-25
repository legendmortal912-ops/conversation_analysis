import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const reportResolvers = {
  Query: {
    reports: async (_: any, { projectId }: { projectId: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      return prisma.report.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
    },
  },
  Mutation: {
    generateReport: async (_: any, { projectId, type, dateFrom, dateTo }: { projectId: string; type: string; dateFrom: Date; dateTo: Date }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      // Create a completed report immediately for the demo to show data
      return prisma.report.create({
        data: {
          title: `Report - ${type} - ${new Date().toISOString()}`,
          organization: { connect: { id: context.orgId } },
          project: { connect: { id: projectId } },
          reportType: type,
          status: 'COMPLETED',
          fileUrl: `https://example.com/reports/${type.toLowerCase()}-${Date.now()}.pdf`,
        },
      });
    },
  },
  Report: {
    type: (parent: any) => parent.reportType,
    url: (parent: any) => parent.fileUrl,
  },
};
