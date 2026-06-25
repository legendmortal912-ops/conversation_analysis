import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const projectResolvers = {
  Query: {
    project: async (_: any, { id }: { id: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ 
        where: { id },
        include: { customRules: true }
      });
      if (!project || project.orgId !== context.orgId) {
        throw new Error('Not found or unauthorized');
      }
      return project;
    },
    projects: async (_: any, __: any, context: { orgId: string }) => {
      if (!context.orgId) {
        throw new Error('UNAUTHENTICATED: Invalid or expired session. Please log in again.');
      }
      return prisma.project.findMany({
        where: { orgId: context.orgId },
        include: { customRules: true },
        orderBy: { createdAt: 'desc' },
      });
    },
  },
  Mutation: {
    createProject: async (_: any, { input }: { input: { name: string } }, context: { orgId: string }) => {
      console.log('createProject called with context orgId:', context.orgId);
      if (!context.orgId) {
        throw new Error('UNAUTHENTICATED: Invalid or expired session. Please log in again.');
      }
      return prisma.project.create({
        data: {
          name: input.name,
          aiSystemName: 'Default AI',
          orgId: context.orgId,
        },
      });
    },
    updateProject: async (_: any, { id, name }: { id: string; name: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');
      return prisma.project.update({
        where: { id },
        data: { name },
      });
    },
    updateProjectSettings: async (_: any, { id, settings }: { id: string; settings: any }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');
      return prisma.project.update({
        where: { id },
        data: { settings },
      });
    },
    createCustomRule: async (_: any, { input }: { input: any }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');
      return prisma.customRule.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          patterns: input.patterns,
          severity: input.severity,
          isEnabled: true,
        },
      });
    },
    updateCustomRule: async (_: any, { id, input }: { id: string, input: any }, context: { orgId: string }) => {
      const rule = await prisma.customRule.findUnique({ where: { id }, include: { project: true } });
      if (!rule || rule.project.orgId !== context.orgId) throw new Error('Unauthorized');
      return prisma.customRule.update({
        where: { id },
        data: {
          ...input,
        },
      });
    },
    deleteCustomRule: async (_: any, { id }: { id: string }, context: { orgId: string }) => {
      const rule = await prisma.customRule.findUnique({ where: { id }, include: { project: true } });
      if (!rule || rule.project.orgId !== context.orgId) throw new Error('Unauthorized');
      await prisma.customRule.delete({ where: { id } });
      return true;
    },
    deleteProject: async (_: any, { id }: { id: string }, context: { orgId: string }) => {
      const project = await prisma.project.findUnique({ where: { id } });
      if (!project || project.orgId !== context.orgId) throw new Error('Unauthorized');
      await prisma.project.delete({ where: { id } });
      return true;
    },
  },
};
