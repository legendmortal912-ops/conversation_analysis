/**
 * @module database/repositories/conversation
 * Repository for Conversation CRUD operations.
 */

import { prisma } from '../postgres.js';
import type { Prisma, Conversation, ConversationStatus } from '@prisma/client';

/** Options for listing conversations with filtering and pagination. */
export interface ListConversationsOptions {
  /** Filter by project ID. */
  projectId?: string;
  /** Filter by organization ID. */
  orgId?: string;
  /** Filter by status. */
  status?: ConversationStatus;
  /** Minimum TiltScore. */
  minTiltScore?: number;
  /** Maximum TiltScore. */
  maxTiltScore?: number;
  /** Filter by grade. */
  grade?: string;
  /** Cursor-based pagination: start after this conversation ID. */
  cursor?: string;
  /** Page size (default: 20). */
  limit?: number;
  /** Sort field. */
  sortBy?: 'createdAt' | 'tiltScore' | 'turnCount' | 'flagCount';
  /** Sort direction (default: 'desc'). */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Data access layer for Conversation records.
 *
 * @example
 * ```ts
 * import { ConversationRepository } from '@convoguard/database';
 *
 * const repo = new ConversationRepository();
 * const conversation = await repo.create({
 *   projectId: 'prj_abc',
 *   orgId: 'org_xyz',
 * });
 * ```
 */
export class ConversationRepository {
  /**
   * Creates a new conversation.
   *
   * @param data - Prisma-compatible creation data
   * @returns The created conversation
   */
  async create(data: Prisma.ConversationCreateInput): Promise<Conversation> {
    return prisma.conversation.create({ data });
  }

  /**
   * Retrieves a conversation by ID.
   *
   * @param id - Conversation ID
   * @returns The conversation, or null if not found
   */
  async getById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({ where: { id } });
  }

  /**
   * Retrieves a conversation by ID, including turns and flags.
   *
   * @param id - Conversation ID
   * @returns The conversation with relations, or null if not found
   */
  async getByIdWithRelations(id: string): Promise<
    | (Conversation & {
        turns: Array<{ id: string; index: number; role: string; content: string; createdAt: Date }>;
        flags: Array<{ id: string; patternName: string; severity: string; confidence: number; createdAt: Date }>;
      })
    | null
  > {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        turns: {
          orderBy: { index: 'asc' },
          select: {
            id: true,
            index: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
        flags: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            patternName: true,
            severity: true,
            confidence: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Lists conversations for a project with filtering and pagination.
   *
   * @param options - Filter, sort, and pagination options
   * @returns Array of conversations matching the criteria
   */
  async listByProject(options: ListConversationsOptions): Promise<Conversation[]> {
    const {
      projectId,
      orgId,
      status,
      minTiltScore,
      maxTiltScore,
      grade,
      cursor,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const where: Prisma.ConversationWhereInput = {};

    if (projectId) {
      where.projectId = projectId;
    }
    if (orgId) {
      where.orgId = orgId;
    }
    if (status) {
      where.status = status;
    }
    if (grade) {
      where.grade = grade;
    }
    if (minTiltScore !== undefined || maxTiltScore !== undefined) {
      where.tiltScore = {};
      if (minTiltScore !== undefined) {
        where.tiltScore.gte = minTiltScore;
      }
      if (maxTiltScore !== undefined) {
        where.tiltScore.lte = maxTiltScore;
      }
    }

    const findArgs: Prisma.ConversationFindManyArgs = {
      where,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    };

    if (cursor) {
      findArgs.skip = 1;
      findArgs.cursor = { id: cursor };
    }

    return prisma.conversation.findMany(findArgs);
  }

  /**
   * Updates a conversation's TiltScore, grade, and optionally status.
   *
   * @param id - Conversation ID
   * @param tiltScore - New TiltScore (0–100)
   * @param grade - New letter grade
   * @param status - Optional new status
   * @returns The updated conversation
   */
  async updateScore(
    id: string,
    tiltScore: number,
    grade: string,
    status?: ConversationStatus
  ): Promise<Conversation> {
    const data: Prisma.ConversationUpdateInput = {
      tiltScore,
      grade,
    };

    if (status) {
      data.status = status;
    }

    return prisma.conversation.update({
      where: { id },
      data,
    });
  }

  /**
   * Increments the turn count for a conversation.
   *
   * @param id - Conversation ID
   * @returns The updated conversation
   */
  async incrementTurnCount(id: string): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: { turnCount: { increment: 1 } },
    });
  }

  /**
   * Increments the flag count for a conversation.
   *
   * @param id - Conversation ID
   * @returns The updated conversation
   */
  async incrementFlagCount(id: string): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: { flagCount: { increment: 1 } },
    });
  }

  /**
   * Marks a conversation as completed.
   *
   * @param id - Conversation ID
   * @returns The updated conversation
   */
  async complete(id: string): Promise<Conversation> {
    return prisma.conversation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });
  }

  /**
   * Counts conversations matching the given filter.
   *
   * @param where - Prisma where clause
   * @returns The count
   */
  async count(where: Prisma.ConversationWhereInput = {}): Promise<number> {
    return prisma.conversation.count({ where });
  }
}
