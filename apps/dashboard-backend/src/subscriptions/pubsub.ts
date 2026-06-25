import { PubSub } from 'graphql-subscriptions';

// For production, this should use RedisPubSub from 'graphql-redis-subscriptions'
// using the ioredis client. For simplicity in this implementation, we use the 
// standard in-memory PubSub.
export const pubsub = new PubSub();

export const TRIGGERS = {
  CONVERSATION_UPDATED: 'CONVERSATION_UPDATED',
  NEW_FLAG: 'NEW_FLAG',
  NEW_ALERT: 'NEW_ALERT',
  METRICS_UPDATED: 'METRICS_UPDATED',
};
