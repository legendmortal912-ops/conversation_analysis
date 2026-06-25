/**
 * @module database/repositories/flag
 * Repository for Flag CRUD operations.
 */

import { prisma } from '../postgres.js';
import type { Prisma, Flag, FlagSeverity } from '@prisma/client';

/** Options for listing flags with filtering. */
export interface ListFlagsOptions {
  /** Filter by conversation ID. */
  conversationId?: string;
  /** Filter by project ID. */
  projectId?: string;
  /** Filter by severity. */
  severity?: FlagSeverity;
  /** Filter by pattern name. */
  patternName?: string;
  /** Minimum confidence threshold. */
  minConfidence?: number;
  /** Cursor for pagination. */
  cursor?: string;
  /** Page size (default: 50). */
  limit?: number;
  /** Sort direction (default: 'desc'). */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Data access layer for Flag records (manipulation detections on turns).
 *
 * @example
 * ```ts
 * import { FlagRepository } from '@convoguard/database';
 *
 * const repo = new FlagRepository();
 * const flags = await repo.getByConversation('cnv_abc123');
 * ```
 */
export class FlagRepository {
  /**
   * Creates a new flag record.
   *
   * @param data - Prisma-compatible creation data
   * @returns The created flag
   */
  async create(data: Prisma.FlagCreateInput): Promise<Flag> {
    return prisma.flag.create({ data });
  }

  /**
   * Retrieves a flag by ID.
   *
   * @param id - Flag ID
   * @returns The flag, or null if not found
   */
  async getById(id: string): Promise<Flag | null> {
    return prisma.flag.findUnique({ where: { id } });
  }

  /**
   * Retrieves all flags for a conversation, ordered by creation time.
   *
   * @param conversationId - The conversation ID
   * @returns Array of flags
   */
  async getByConversation(conversationId: string): Promise<Flag[]> {
    return prisma.flag.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Retrieves flags for a project with optional filtering and pagination.
   *
   * @param options - Filter and pagination options
   * @returns Array of flags matching the criteria
   */
  async getByProject(options: ListFlagsOptions): Promise<Flag[]> {
    const {
      projectId,
      conversationId,
      severity,
      patternName,
      minConfidence,
      cursor,
      limit = 50,
      sortOrder = 'desc',
    } = options;

    const where: Prisma.FlagWhereInput = {};

    if (projectId) {
      where.projectId = projectId;
    }
    if (conversationId) {
      where.conversationId = conversationId;
    }
    if (severity) {
      where.severity = severity;
    }
    if (patternName) {
      where.patternName = patternName;
    }
    if (minConfidence !== undefined) {
      where.confidence = { gte: minConfidence };
    }

    const findArgs: Prisma.FlagFindManyArgs = {
      where,
      take: limit,
      orderBy: { createdAt: sortOrder },
    };

    if (cursor) {
      findArgs.skip = 1;
      findArgs.cursor = { id: cursor };
    }

    return prisma.flag.findMany(findArgs);
  }

  /**
   * Counts flags matching the given filter.
   *
   * @param where - Prisma where clause
   * @returns The count
   */
  async count(where: Prisma.FlagWhereInput = {}): Promise<number> {
    return prisma.flag.count({ where });
  }

  /**
   * Gets the distribution of flags by severity for a project.
   *
   * @param projectId - The project ID
   * @returns Array of { severity, count } objects
   */
  async getSeverityDistribution(
    projectId: string
  ): Promise<Array<{ severity: FlagSeverity; _count: number }>> {
    const result = await prisma.flag.groupBy({
      by: ['severity'],
      where: { projectId },
      _count: true,
    });
    return result.map((r) => ({
      severity: r.severity,
      _count: r._count,
    }));
  }

  /**
   * Gets the most common patterns for a project.
   *
   * @param projectId - The project ID
   * @param limit - Maximum number of patterns to return (default: 10)
   * @returns Array of { patternName, count } objects, ordered by frequency
   */
  async getTopPatterns(
    projectId: string,
    limit: number = 10
  ): Promise<Array<{ patternName: string; _count: number }>> {
    const result = await prisma.flag.groupBy({
      by: ['patternName'],
      where: { projectId },
      _count: true,
      orderBy: { _count: { patternName: 'desc' } },
      take: limit,
    });
    return result.map((r) => ({
      patternName: r.patternName,
      _count: r._count,
    }));
  }
}
