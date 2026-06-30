/**
 * @module conversation
 * Conversation, Turn, Flag, FlagReview, and ConversationScore types
 * representing the core domain model for AI manipulation detection.
 */

import type { FlagSeverity } from './organization.js';
export type { FlagSeverity };

/** Who sent a particular turn in a conversation. */
export type TurnRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

/** Status of a human review on a flag. */
export type ReviewVerdict = 'CONFIRMED' | 'DISMISSED' | 'ESCALATED';

/** Overall conversation status. */
export type ConversationStatus = 'ACTIVE' | 'COMPLETED' | 'FLAGGED' | 'ARCHIVED';

/** Letter grade derived from the TiltScore. */
export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * A conversation represents a complete dialogue session between
 * a user and an AI system that is being monitored.
 */
export interface Conversation {
  /** Unique identifier (nanoid). */
  id: string;
  /** Project this conversation belongs to. */
  projectId: string;
  /** Organization (denormalized for fast queries). */
  orgId: string;
  /** External identifier provided by the client SDK. */
  externalId: string | null;
  /** Current status. */
  status: ConversationStatus;
  /** Computed TiltScore (0–100, 0 = safe, 100 = severe manipulation). */
  tiltScore: number | null;
  /** Letter grade derived from the TiltScore. */
  grade: ScoreGrade | null;
  /** Number of turns in the conversation. */
  turnCount: number;
  /** Number of flags raised. */
  flagCount: number;
  /** Arbitrary metadata attached by the client SDK. */
  metadata: Record<string, unknown>;
  /** ISO-8601 timestamp when the conversation started. */
  startedAt: string;
  /** ISO-8601 timestamp when the conversation ended, or null if still active. */
  endedAt: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/**
 * A single turn (message) within a conversation.
 * Each turn is individually hash-chained for tamper-evidence.
 */
export interface Turn {
  /** Unique identifier (nanoid). */
  id: string;
  /** Parent conversation. */
  conversationId: string;
  /** Zero-based index within the conversation. */
  index: number;
  /** Who sent this turn. */
  role: TurnRole;
  /** The textual content of the turn. */
  content: string;
  /** Token count for this turn (used for billing). */
  tokenCount: number;
  /** SHA-256 hash of this turn's canonical content for tamper-evidence. */
  contentHash: string;
  /** Hash of the previous turn (or genesis hash for index 0). */
  previousHash: string;
  /** Milliseconds of latency for the AI's response (assistant turns only). */
  latencyMs: number | null;
  /** Model identifier (e.g. "gpt-4o") if known. */
  model: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * A manipulation flag raised by the detection engine on a specific turn.
 */
export interface Flag {
  /** Unique identifier (nanoid). */
  id: string;
  /** The turn that triggered this flag. */
  turnId: string;
  /** Parent conversation (denormalized). */
  conversationId: string;
  /** Project (denormalized). */
  projectId: string;
  /** The manipulation pattern that was detected. */
  patternName: string;
  /** Human-readable description of why this flag was raised. */
  description: string;
  /** Severity assessment. */
  severity: FlagSeverity;
  /** Confidence score from the detection model (0.0–1.0). */
  confidence: number;
  /** Exact text span that triggered the flag. */
  evidence: string;
  /** Weighted contribution of this flag to the TiltScore. */
  scoreImpact: number;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * A human review verdict on a flag — confirms, dismisses, or escalates it.
 */
export interface FlagReview {
  /** Unique identifier (nanoid). */
  id: string;
  /** The flag being reviewed. */
  flagId: string;
  /** The user who performed the review. */
  reviewerId: string;
  /** The review verdict. */
  verdict: ReviewVerdict;
  /** Optional notes explaining the decision. */
  notes: string | null;
  /** ISO-8601 timestamp. */
  createdAt: string;
}

/**
 * Aggregated score snapshot for a conversation — computed after
 * each new flag or periodically by the scoring engine.
 */
export interface ConversationScore {
  /** Parent conversation. */
  conversationId: string;
  /** Overall TiltScore (0–100). */
  tiltScore: number;
  /** Letter grade. */
  grade: ScoreGrade;
  /** Breakdown of score contributions by pattern category. */
  breakdown: Record<string, number>;
  /** Total number of flags contributing to this score. */
  flagCount: number;
  /** Weighted severity sum used in the calculation. */
  weightedSeveritySum: number;
  /** ISO-8601 timestamp when this score was computed. */
  computedAt: string;
}
