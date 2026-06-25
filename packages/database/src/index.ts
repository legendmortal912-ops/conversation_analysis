/**
 * @module @convoguard/database
 * Database client wrappers (PostgreSQL, ImmuDB, Redis) and data repositories.
 *
 * @example
 * ```ts
 * import {
 *   prisma,
 *   redis,
 *   createImmudbClient,
 *   createQueue,
 *   QUEUE_NAMES,
 *   ConversationRepository,
 * } from '@convoguard/database';
 * ```
 */

// Postgres (Prisma)
export { prisma, disconnectPrisma } from './postgres.js';

// ImmuDB (REST via immugw)
export {
  ImmudbClient,
  createImmudbClient,
} from './immudb.js';
export type {
  ImmudbConfig,
  VerifiedResponse,
  ImmudbKeyValue,
  SqlQueryResult,
} from './immudb.js';

// Redis & BullMQ
export {
  redis,
  disconnectRedis,
  createQueue,
  createWorker,
  QUEUE_NAMES,
} from './redis.js';

// Repositories
export {
  ConversationRepository,
  TurnRepository,
  FlagRepository,
} from './repositories/index.js';
export type {
  ListConversationsOptions,
  ListFlagsOptions,
} from './repositories/index.js';
