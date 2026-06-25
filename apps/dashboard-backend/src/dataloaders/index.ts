import DataLoader from 'dataloader';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DataLoaders {
  turnsByConversationId: DataLoader<string, any[]>;
  flagsByTurnId: DataLoader<string, any[]>;
  flagsByConversationId: DataLoader<string, any[]>;
  projectsByOrgId: DataLoader<string, any[]>;
}

export function createDataLoaders(): DataLoaders {
  return {
    turnsByConversationId: new DataLoader(async (conversationIds: readonly string[]) => {
      const turns = await prisma.turn.findMany({
        where: { conversationId: { in: [...conversationIds] } },
        orderBy: { createdAt: 'asc' },
      });
      const turnsMap = turns.reduce((acc, turn) => {
        if (!acc[turn.conversationId]) acc[turn.conversationId] = [];
        acc[turn.conversationId].push(turn);
        return acc;
      }, {} as Record<string, any[]>);
      return conversationIds.map((id) => turnsMap[id] || []);
    }),

    flagsByTurnId: new DataLoader(async (turnIds: readonly string[]) => {
      const flags = await prisma.flag.findMany({
        where: { turnId: { in: [...turnIds] } },
      });
      const flagsMap = flags.reduce((acc, flag) => {
        if (flag.turnId) {
          if (!acc[flag.turnId]) acc[flag.turnId] = [];
          acc[flag.turnId].push(flag);
        }
        return acc;
      }, {} as Record<string, any[]>);
      return turnIds.map((id) => flagsMap[id] || []);
    }),

    flagsByConversationId: new DataLoader(async (conversationIds: readonly string[]) => {
      const flags = await prisma.flag.findMany({
        where: { conversationId: { in: [...conversationIds] } },
      });
      const flagsMap = flags.reduce((acc, flag) => {
        if (!acc[flag.conversationId]) acc[flag.conversationId] = [];
        acc[flag.conversationId].push(flag);
        return acc;
      }, {} as Record<string, any[]>);
      return conversationIds.map((id) => flagsMap[id] || []);
    }),

    projectsByOrgId: new DataLoader(async (orgIds: readonly string[]) => {
      const projects = await prisma.project.findMany({
        where: { orgId: { in: [...orgIds] } },
      });
      const projectsMap = projects.reduce((acc, project) => {
        if (!acc[project.orgId]) acc[project.orgId] = [];
        acc[project.orgId].push(project);
        return acc;
      }, {} as Record<string, any[]>);
      return orgIds.map((id) => projectsMap[id] || []);
    }),
  };
}
