import { PrismaClient } from '@prisma/client';
import type { DataLoaders } from '../../dataloaders/index.js';

const prisma = new PrismaClient();

export const organizationResolvers = {
  Query: {
    organization: async (_: any, __: any, context: { orgId: string }) => {
      if (!context.orgId) throw new Error('Unauthorized');
      return prisma.organization.findUnique({ where: { id: context.orgId } });
    },

    members: async (_: any, __: any, context: { orgId: string }) => {
      if (!context.orgId) throw new Error('Unauthorized');
      return prisma.user.findMany({
        where: { orgId: context.orgId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
    },

    alertConfigs: async (_: any, { projectId }: { projectId: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');
      return prisma.alertConfig.findMany({ where: { projectId } });
    },

    usageStats: async (_: any, __: any, context: { orgId: string }) => {
      if (!context.orgId) throw new Error('Unauthorized');
      const org = await prisma.organization.findUnique({ where: { id: context.orgId } });
      if (!org) throw new Error('Organization not found');
      const [totalConversations, totalTurns, totalFlags] = await Promise.all([
        prisma.conversation.count({ where: { orgId: context.orgId } }),
        prisma.turn.count({ where: { conversation: { orgId: context.orgId } } }),
        prisma.flag.count({ where: { conversation: { orgId: context.orgId } } }),
      ]);
      return { totalConversations, totalTurns, totalFlags, plan: org.plan, orgName: org.name };
    },

    dashboardMetrics: async (_: any, { projectId }: { projectId: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      const [totalConversations, totalTurns, flaggedConvs, flags, pendingAlerts] = await Promise.all([
        prisma.conversation.count({ where: { projectId } }),
        prisma.turn.count({ where: { conversation: { projectId } } }),
        prisma.conversation.count({ where: { projectId, flagCount: { gt: 0 } } }),
        prisma.flag.findMany({ where: { projectId }, select: { patternName: true } }),
        (async () => {
          const configs = await prisma.alertConfig.findMany({ where: { projectId }, select: { id: true } });
          if (configs.length === 0) return 0;
          return prisma.alert.count({ where: { alertConfigId: { in: configs.map((c) => c.id) }, status: 'PENDING' } });
        })(),
      ]);

      const avgResult = await prisma.conversation.aggregate({
        where: { projectId, tiltScore: { not: null } },
        _avg: { tiltScore: true },
      });
      const avgTiltScore = avgResult._avg.tiltScore ?? null;

      // Pattern counts
      const patternCounts: Record<string, number> = {};
      flags.forEach((f) => {
        patternCounts[f.patternName] = (patternCounts[f.patternName] || 0) + 1;
      });

      // Daily stats — last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentConvs = await prisma.conversation.findMany({
        where: { projectId, startedAt: { gte: sevenDaysAgo } },
        select: { startedAt: true, flagCount: true, tiltScore: true },
      });

      const dayMap: Record<string, { conversations: number; flags: number; scores: number[] }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = { conversations: 0, flags: 0, scores: [] };
      }
      recentConvs.forEach((c) => {
        const key = c.startedAt.toISOString().slice(0, 10);
        if (dayMap[key]) {
          dayMap[key].conversations++;
          dayMap[key].flags += c.flagCount;
          if (c.tiltScore != null) dayMap[key].scores.push(c.tiltScore);
        }
      });
      const dailyStats = Object.entries(dayMap).map(([date, v]) => ({
        date,
        conversations: v.conversations,
        flags: v.flags,
        avgScore: v.scores.length > 0 ? v.scores.reduce((a, b) => a + b, 0) / v.scores.length : null,
      }));

      return {
        totalConversations,
        totalTurns,
        flaggedTurns: flaggedConvs,
        avgTiltScore,
        criticalAlerts: pendingAlerts,
        patternCounts,
        dailyStats,
      };
    },
  },

  Mutation: {
    updateOrganization: async (_: any, { name }: { name: string }, context: { orgId: string }) => {
      if (!context.orgId) throw new Error('Unauthorized');
      return prisma.organization.update({ where: { id: context.orgId }, data: { name } });
    },

    upsertAlertConfig: async (
      _: any,
      { projectId, channel, webhookUrl, slackWebhookUrl, emailAddresses, enabled }: any,
      context: { orgId: string }
    ) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');
      const existing = await prisma.alertConfig.findFirst({ where: { projectId, channel } });
      if (existing) {
        return prisma.alertConfig.update({
          where: { id: existing.id },
          data: { webhookUrl, slackWebhookUrl, emailAddresses: emailAddresses ?? [], enabled },
        });
      }
      return prisma.alertConfig.create({
        data: { projectId, channel, webhookUrl, slackWebhookUrl, emailAddresses: emailAddresses ?? [], enabled },
      });
    },

    deleteAlertConfig: async (_: any, { id }: { id: string }, context: { orgId: string }) => {
      const config = await prisma.alertConfig.findUnique({ where: { id }, include: { project: true } });
      if (!config || config.project.orgId !== context.orgId) throw new Error('Unauthorized');
      await prisma.alertConfig.delete({ where: { id } });
      return true;
    },
  },

  Organization: {
    users: async (parent: any) => {
      return prisma.user.findMany({ where: { orgId: parent.id } });
    },
    projects: async (parent: any, _: any, context: { loaders: DataLoaders }) => {
      return context.loaders.projectsByOrgId.load(parent.id);
    },
  },
};
