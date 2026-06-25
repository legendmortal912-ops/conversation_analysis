import { PrismaClient, AlertChannel } from '@prisma/client';

const prisma = new PrismaClient();

export const alertResolvers = {
  Query: {
    alerts: async (
      _: any,
      { projectId, limit = 50, unacknowledgedOnly = false }: { projectId?: string; limit?: number; unacknowledgedOnly?: boolean },
      context: { orgId: string }
    ) => {
      let configIds: string[] = [];

      if (projectId) {
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

        const alertConfigs = await prisma.alertConfig.findMany({
          where: { projectId },
          select: { id: true },
        });
        configIds = alertConfigs.map((c) => c.id);
      } else {
        // Fetch all config IDs for the org's projects
        const alertConfigs = await prisma.alertConfig.findMany({
          where: { project: { orgId: context.orgId } },
          select: { id: true },
        });
        configIds = alertConfigs.map((c) => c.id);
      }

      if (configIds.length === 0) return [];

      const where: any = { alertConfigId: { in: configIds } };
      if (unacknowledgedOnly) where.status = 'PENDING';

      const alerts = await prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          conversation: {
            include: {
              project: { select: { name: true } }
            }
          }
        },
      });

      // Fetch flags to get pattern and severity
      const flagIds = alerts.map(a => a.flagId).filter(Boolean) as string[];
      let flags: any[] = [];
      if (flagIds.length > 0) {
        flags = await prisma.flag.findMany({ where: { id: { in: flagIds } } });
      }
      const flagMap = new Map(flags.map(f => [f.id, f]));

      return alerts.map(a => {
        const flag = a.flagId ? flagMap.get(a.flagId) : null;
        return {
          id: a.id,
          message: a.message,
          status: a.status,
          createdAt: a.createdAt,
          tiltScore: a.tiltScore,
          pattern: flag ? flag.patternName : null,
          severity: flag ? flag.severity : 'LOW',
          modelName: a.conversation?.project?.name ?? 'Unknown',
          conversationId: a.conversation?.id,
        };
      });
    },
  },

  Mutation: {
    acknowledgeAlert: async (_: any, { alertId }: { alertId: string }, context: { orgId: string }) => {
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: { conversation: { include: { project: true } } },
      });

      if (!alert || alert.conversation.project.orgId !== context.orgId) {
        throw new Error('Not found or unauthorized');
      }

      return prisma.alert.update({
        where: { id: alertId },
        data: { status: 'DELIVERED' },
        include: { conversation: { select: { id: true, externalId: true } } },
      });
    },

    updateAlertSettings: async (
      _: any,
      { projectId, isActive }: { projectId: string; isActive: boolean },
      context: { orgId: string }
    ) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      const existing = await prisma.alertConfig.findFirst({ where: { projectId } });
      if (existing) {
        await prisma.alertConfig.update({ where: { id: existing.id }, data: { enabled: isActive } });
      } else {
        await prisma.alertConfig.create({
          data: { projectId, enabled: isActive, channel: 'WEBHOOK' as AlertChannel },
        });
      }
      return true;
    },
  },
};
