/**
 * @module metrics
 * MetricSnapshot and CohortComparison types for analytics dashboards.
 */

import type { ScoreGrade } from './conversation.js';

/** Time granularity for metric aggregation. */
export type MetricGranularity = 'hour' | 'day' | 'week' | 'month';

/**
 * A point-in-time snapshot of key metrics for a project or organization.
 * Used to power dashboards and trend charts.
 */
export interface MetricSnapshot {
  /** Unique identifier (nanoid). */
  id: string;
  /** Project this snapshot pertains to. */
  projectId: string;
  /** Organization (denormalized). */
  orgId: string;
  /** ISO-8601 period start. */
  periodStart: string;
  /** ISO-8601 period end. */
  periodEnd: string;
  /** Aggregation granularity. */
  granularity: MetricGranularity;
  /** Total conversations in this period. */
  totalConversations: number;
  /** Conversations that received at least one flag. */
  flaggedConversations: number;
  /** Total flags raised across all conversations. */
  totalFlags: number;
  /** Average TiltScore for conversations in this period. */
  averageTiltScore: number;
  /** Median TiltScore. */
  medianTiltScore: number;
  /** 95th-percentile TiltScore (worst 5%). */
  p95TiltScore: number;
  /** Distribution of grades across conversations. */
  gradeDistribution: Record<ScoreGrade, number>;
  /** Top manipulation patterns by frequency: pattern → count. */
  topPatterns: Record<string, number>;
  /** Total tokens processed in this period. */
  totalTokens: number;
  /** Average conversation length in turns. */
  averageTurnCount: number;
  /** ISO-8601 timestamp when this snapshot was computed. */
  computedAt: string;
}

/**
 * Compares metrics between two cohorts (e.g. this week vs. last week,
 * or Project A vs. Project B) for side-by-side analysis.
 */
export interface CohortComparison {
  /** Descriptive label for cohort A (e.g. "This Week"). */
  cohortALabel: string;
  /** Descriptive label for cohort B (e.g. "Last Week"). */
  cohortBLabel: string;
  /** Snapshot for cohort A. */
  cohortA: MetricSnapshot;
  /** Snapshot for cohort B. */
  cohortB: MetricSnapshot;
  /** Absolute deltas: key → (cohortA value − cohortB value). */
  deltas: MetricDeltas;
}

/** Computed deltas between two metric snapshots. */
export interface MetricDeltas {
  /** Change in total conversations. */
  totalConversations: number;
  /** Change in flagged conversations. */
  flaggedConversations: number;
  /** Change in total flags. */
  totalFlags: number;
  /** Change in average TiltScore. */
  averageTiltScore: number;
  /** Change in median TiltScore. */
  medianTiltScore: number;
  /** Change in total tokens. */
  totalTokens: number;
  /** Percentage change in flagged-conversation rate. */
  flagRateChangePercent: number;
}
