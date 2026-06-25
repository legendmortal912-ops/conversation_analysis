/**
 * @module database/repositories/turn
 * Repository for Turn CRUD operations.
 */

import { prisma } from '../postgres.js';
import type { Prisma, Turn } from '@prisma/client';

/**
 * Data access layer for Turn records (individual messages within a conversation).
 *
 * @example
 * ```ts
 * import { TurnRepository } from '@convoguard/database';
 *
 * const repo = new TurnRepository();
 * const turn = await repo.create({
 *   conversation: { connect: { id: 'cnv_abc' } },
 *   index: 0,
 *   role: 'USER',
 *   content: 'Hello',
 *   contentHash: 'abc123...',
 *   previousHash: 'genesis...',
 * });
 * ```
 */
export class TurnRepository {
  /**
   * Creates a new turn record.
   *
   * @param data - Prisma-compatible creation data
   * @returns The created turn
   */
  async create(data: Prisma.TurnCreateInput): Promise<Turn> {
    return prisma.turn.create({ data });
  }

  /**
   * Retrieves all turns for a conversation, ordered by index ascending.
   *
   * @param conversationId - The conversation to fetch turns for
   * @returns Ordered array of turns
   */
  async getByConversation(conversationId: string): Promise<Turn[]> {
    return prisma.turn.findMany({
      where: { conversationId },
      orderBy: { index: 'asc' },
    });
  }

  /**
   * Retrieves a single turn by its ID.
   *
   * @param id - Turn ID
   * @returns The turn, or null if not found
   */
  async getById(id: string): Promise<Turn | null> {
    return prisma.turn.findUnique({ where: { id } });
  }

  /**
   * Retrieves the last turn in a conversation (highest index).
   *
   * @param conversationId - The conversation ID
   * @returns The last turn, or null if no turns exist
   */
  async getLastTurn(conversationId: string): Promise<Turn | null> {
    return prisma.turn.findFirst({
      where: { conversationId },
      orderBy: { index: 'desc' },
    });
  }

  /**
   * Counts the number of turns in a conversation.
   *
   * @param conversationId - The conversation ID
   * @returns The number of turns
   */
  async countByConversation(conversationId: string): Promise<number> {
    return prisma.turn.count({
      where: { conversationId },
    });
  }

  /**
   * Retrieves turns within an index range for a conversation.
   *
   * @param conversationId - The conversation ID
   * @param fromIndex - Start index (inclusive)
   * @param toIndex - End index (inclusive)
   * @returns Array of turns in the specified range
   */
  async getByIndexRange(
    conversationId: string,
    fromIndex: number,
    toIndex: number
  ): Promise<Turn[]> {
    return prisma.turn.findMany({
      where: {
        conversationId,
        index: {
          gte: fromIndex,
          lte: toIndex,
        },
      },
      orderBy: { index: 'asc' },
    });
  }
}
