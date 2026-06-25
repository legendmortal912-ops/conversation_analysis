/**
 * @module database/postgres
 * Prisma client singleton with connection pooling.
 *
 * Uses a global variable to prevent multiple instances during development
 * hot-reloading (Next.js / tsx --watch patterns).
 */

import { PrismaClient } from '@prisma/client';

/** Global augmentation to persist the Prisma client across hot-reloads. */
const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined;
};

/**
 * Shared Prisma client instance.
 *
 * In production, a single instance is created and reused.
 * In development, the instance is cached on `globalThis` to survive
 * module hot-reloading without exhausting database connections.
 *
 * @example
 * ```ts
 * import { prisma } from '@convoguard/database';
 *
 * const orgs = await prisma.organization.findMany();
 * ```
 */
export const prisma: PrismaClient =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasourceUrl: process.env['DATABASE_URL'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.__prisma = prisma;
}

/**
 * Gracefully disconnects the Prisma client.
 * Call this during application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
