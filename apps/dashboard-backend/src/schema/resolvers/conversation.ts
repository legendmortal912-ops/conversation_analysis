import { PrismaClient } from '@prisma/client';
import type { DataLoaders } from '../../dataloaders/index.js';

const prisma = new PrismaClient();

export const conversationResolvers = {
  Query: {
    conversation: async (_: any, { id }: { id: string }, context: { orgId: string }) => {
      const conversation = await prisma.conversation.findUnique({ where: { id }, include: { project: true } });
      if (!conversation || conversation.project.orgId !== context.orgId) {
        throw new Error('Not found or unauthorized');
      }
      return conversation;
    },
    conversations: async (_: any, args: any, context: { orgId: string }) => {
      const { projectId, first = 20, after, filters } = args;

      // Verify project belongs to org
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      const where: any = { projectId };
      
      if (filters) {
        if (filters.status) where.status = filters.status;
        if (filters.hasFlags !== undefined) {
          where.flaggedTurns = filters.hasFlags ? { gt: 0 } : 0;
        }
        if (filters.dateFrom || filters.dateTo) {
          where.startedAt = {};
          if (filters.dateFrom) where.startedAt.gte = filters.dateFrom;
          if (filters.dateTo) where.startedAt.lte = filters.dateTo;
        }
      }

      const totalCount = await prisma.conversation.count({ where });

      let cursorOpts = {};
      if (after) {
        cursorOpts = {
          cursor: { id: after },
          skip: 1, // Skip the cursor element itself
        };
      }

      const items = await prisma.conversation.findMany({
        where,
        take: first,
        ...cursorOpts,
        orderBy: { startedAt: 'desc' },
      });

      const edges = items.map((item) => ({
        node: item,
        cursor: item.id,
      }));

      return {
        edges,
        totalCount,
        pageInfo: {
          hasNextPage: items.length === first,
          endCursor: items.length > 0 ? items[items.length - 1].id : null,
        },
      };
    },
    searchConversations: async (_: any, { projectId, query }: { projectId: string; query: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      // Simple implementation. In production, use Elasticsearch/Typesense or Postgres Full-Text Search.
      return prisma.conversation.findMany({
        where: {
          projectId,
          OR: [
            { externalId: { contains: query, mode: 'insensitive' } },
            // Searching through JSON is limited in standard prisma, usually requires raw query
          ],
        },
        take: 20,
      });
    },
  },
  Conversation: {
    turns: async (parent: any, _: any, context: { loaders: DataLoaders }) => {
      return context.loaders.turnsByConversationId.load(parent.id);
    },
    flags: async (parent: any, _: any, context: { loaders: DataLoaders }) => {
      return context.loaders.flagsByConversationId.load(parent.id);
    },
    score: (parent: any) => parent.score,
  },
  Mutation: {
    saveAnalyzedConversation: async (_: any, { projectId, payload }: { projectId: string; payload: any }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');

      const { conversationId, tiltScore, grade, turns, flags } = payload;

      const conversation = await prisma.conversation.create({
        data: {
          id: conversationId,
          projectId,
          orgId: context.orgId,
          status: 'COMPLETED',
          startedAt: new Date(),
          endedAt: new Date(),
          tiltScore,
          grade,
          turnCount: turns?.length || 0,
          flagCount: flags?.length || 0,
        },
      });

      if (turns && turns.length > 0) {
        await prisma.turn.createMany({
          data: turns.map((t: any, i: number) => ({
            id: `turn_${conversationId}_${i}`,
            conversationId: conversation.id,
            role: t.role.toUpperCase(),
            content: t.content,
            index: i,
            contentHash: `hash-${i}`,
            previousHash: `phash-${i}`,
          })),
        });
      }

      if (flags && flags.length > 0) {
        await prisma.flag.createMany({
          data: flags.map((f: any, i: number) => ({
            id: `flag_${conversationId}_${i}`,
            turnId: `turn_${conversationId}_${f.turnIndex || 0}`,
            conversationId: conversation.id,
            projectId,
            patternName: f.patternName,
            severity: (f.severity === 'NONE' ? 'LOW' : (f.severity || 'LOW')).toUpperCase(),
            confidence: f.confidence || 0,
            description: f.description || '',
            evidence: f.evidence || '',
            scoreImpact: f.scoreImpact || 0,
          })),
        });
      }

      return conversation;
    },
  },
};
