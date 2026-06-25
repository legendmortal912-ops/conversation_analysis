/**
 * @module schemas/conversation
 * Zod validation schemas for conversation, turn, and flag payloads.
 * Used at API boundaries to validate incoming requests.
 */

import { z } from 'zod';

// ── Enums ────────────────────────────────────────────────────────────

/** Zod schema for turn role. */
export const TurnRoleSchema = z.enum(['user', 'assistant', 'system']);

/** Zod schema for flag severity. */
export const FlagSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/** Zod schema for review verdict. */
export const ReviewVerdictSchema = z.enum(['confirmed', 'dismissed', 'escalated']);

/** Zod schema for conversation status. */
export const ConversationStatusSchema = z.enum(['active', 'completed', 'flagged', 'archived']);

/** Zod schema for score grades. */
export const ScoreGradeSchema = z.enum(['A', 'B', 'C', 'D', 'F']);

// ── Create Payloads ──────────────────────────────────────────────────

/**
 * Schema for creating a new conversation via the SDK/API.
 */
export const CreateConversationSchema = z.object({
  /** Project to attach this conversation to. */
  projectId: z.string().min(1, 'projectId is required'),
  /** Optional external ID from the client system. */
  externalId: z.string().nullish().transform((v) => v ?? null),
  /** Optional metadata. */
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

/** Inferred type from CreateConversationSchema. */
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;

/**
 * Schema for appending a turn to a conversation.
 */
export const CreateTurnSchema = z.object({
  /** Conversation this turn belongs to. */
  conversationId: z.string().min(1, 'conversationId is required'),
  /** Who sent this turn. */
  role: TurnRoleSchema,
  /** Text content of the turn. */
  content: z.string().min(1, 'content cannot be empty'),
  /** Token count (non-negative integer). */
  tokenCount: z.number().int().nonnegative().optional().default(0),
  /** Latency for assistant responses in milliseconds. */
  latencyMs: z.number().nonnegative().nullish().transform((v) => v ?? null),
  /** Model identifier (e.g. "gpt-4o"). */
  model: z.string().nullish().transform((v) => v ?? null),
});

/** Inferred type from CreateTurnSchema. */
export type CreateTurnInput = z.infer<typeof CreateTurnSchema>;

/**
 * Schema for creating a flag on a turn.
 */
export const CreateFlagSchema = z.object({
  /** Turn that triggered this flag. */
  turnId: z.string().min(1, 'turnId is required'),
  /** Conversation (denormalized). */
  conversationId: z.string().min(1, 'conversationId is required'),
  /** Project (denormalized). */
  projectId: z.string().min(1, 'projectId is required'),
  /** Manipulation pattern name (must match a known pattern). */
  patternName: z.string().min(1, 'patternName is required'),
  /** Human-readable description. */
  description: z.string().min(1, 'description is required'),
  /** Severity level. */
  severity: FlagSeveritySchema,
  /** Detection confidence (0.0–1.0). */
  confidence: z.number().min(0).max(1),
  /** Exact evidence text span. */
  evidence: z.string().min(1, 'evidence is required'),
  /** Computed score impact. */
  scoreImpact: z.number().nonnegative(),
});

/** Inferred type from CreateFlagSchema. */
export type CreateFlagInput = z.infer<typeof CreateFlagSchema>;

/**
 * Schema for submitting a human review on a flag.
 */
export const CreateFlagReviewSchema = z.object({
  /** Flag being reviewed. */
  flagId: z.string().min(1, 'flagId is required'),
  /** Reviewer's user ID. */
  reviewerId: z.string().min(1, 'reviewerId is required'),
  /** Verdict. */
  verdict: ReviewVerdictSchema,
  /** Optional reviewer notes. */
  notes: z.string().nullish().transform((v) => v ?? null),
});

/** Inferred type from CreateFlagReviewSchema. */
export type CreateFlagReviewInput = z.infer<typeof CreateFlagReviewSchema>;

// ── Query / Filter Schemas ───────────────────────────────────────────

/**
 * Schema for listing conversations with filters.
 */
export const ListConversationsQuerySchema = z.object({
  /** Filter by project. */
  projectId: z.string().optional(),
  /** Filter by status. */
  status: ConversationStatusSchema.optional(),
  /** Minimum TiltScore filter. */
  minTiltScore: z.number().min(0).max(100).optional(),
  /** Maximum TiltScore filter. */
  maxTiltScore: z.number().min(0).max(100).optional(),
  /** Filter by grade. */
  grade: ScoreGradeSchema.optional(),
  /** Pagination cursor (conversation ID). */
  cursor: z.string().optional(),
  /** Page size (default 20, max 100). */
  limit: z.number().int().min(1).max(100).optional().default(20),
  /** Sort field. */
  sortBy: z.enum(['createdAt', 'tiltScore', 'turnCount', 'flagCount']).optional().default('createdAt'),
  /** Sort direction. */
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/** Inferred type from ListConversationsQuerySchema. */
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

/**
 * Schema for updating a conversation's score.
 */
export const UpdateConversationScoreSchema = z.object({
  /** New TiltScore. */
  tiltScore: z.number().min(0).max(100),
  /** New grade. */
  grade: ScoreGradeSchema,
  /** New status (optional). */
  status: ConversationStatusSchema.optional(),
});

/** Inferred type from UpdateConversationScoreSchema. */
export type UpdateConversationScoreInput = z.infer<typeof UpdateConversationScoreSchema>;
