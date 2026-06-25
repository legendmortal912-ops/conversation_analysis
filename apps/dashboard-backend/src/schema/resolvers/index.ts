import { organizationResolvers } from './organization.js';
import { projectResolvers } from './project.js';
import { conversationResolvers } from './conversation.js';
import { turnResolvers } from './turn.js';
import { flagResolvers } from './flag.js';
import { alertResolvers } from './alert.js';
import { metricsResolvers } from './metrics.js';
import { reportResolvers } from './report.js';
import { userResolvers } from './user.js';
import { pubsub, TRIGGERS } from '../../subscriptions/pubsub.js';

export const resolvers = {
  Query: {
    ...organizationResolvers.Query,
    ...projectResolvers.Query,
    ...conversationResolvers.Query,
    ...flagResolvers.Query,
    ...alertResolvers.Query,
    ...metricsResolvers.Query,
    ...reportResolvers.Query,
    ...userResolvers.Query,
  },
  Mutation: {
    ...organizationResolvers.Mutation,
    ...projectResolvers.Mutation,
    ...conversationResolvers.Mutation,
    ...flagResolvers.Mutation,
    ...alertResolvers.Mutation,
    ...reportResolvers.Mutation,
    ...userResolvers.Mutation,
  },
  Subscription: {
    conversationUpdated: {
      subscribe: (_: any, { projectId }: { projectId: string }) => pubsub.asyncIterator(`${TRIGGERS.CONVERSATION_UPDATED}_${projectId}`),
    },
    newFlag: {
      subscribe: (_: any, { projectId }: { projectId: string }) => pubsub.asyncIterator(`${TRIGGERS.NEW_FLAG}_${projectId}`),
    },
    newAlert: {
      subscribe: (_: any, { projectId }: { projectId: string }) => pubsub.asyncIterator(`${TRIGGERS.NEW_ALERT}_${projectId}`),
    },
    metricsUpdated: {
      subscribe: (_: any, { projectId }: { projectId: string }) => pubsub.asyncIterator(`${TRIGGERS.METRICS_UPDATED}_${projectId}`),
    },
  },
  Organization: organizationResolvers.Organization,
  Project: {},
  Conversation: conversationResolvers.Conversation,
  Turn: turnResolvers.Turn,
  Flag: flagResolvers.Flag,
  User: userResolvers.User,
  Report: reportResolvers.Report,
};
