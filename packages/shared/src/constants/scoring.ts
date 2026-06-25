/**
 * @module constants/scoring
 * TiltScore computation constants: severity weights, grade thresholds,
 * and scoring algorithm parameters.
 */

import type { FlagSeverity, ScoreGrade } from '../types/conversation.js';

/**
 * Numeric weight for each severity level.
 * Used in the weighted sum that produces the TiltScore.
 */
export const SEVERITY_WEIGHTS: Record<FlagSeverity, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
} as const;

/**
 * Grade thresholds — TiltScore ranges mapped to letter grades.
 * Lower TiltScore = better (less manipulation detected).
 *
 * | Grade | TiltScore Range |
 * |-------|-----------------|
 * | A     | 0 – 10          |
 * | B     | 11 – 25         |
 * | C     | 26 – 50         |
 * | D     | 51 – 75         |
 * | F     | 76 – 100        |
 */
export const GRADE_THRESHOLDS: ReadonlyArray<{ readonly maxScore: number; readonly grade: ScoreGrade }> = [
  { maxScore: 10, grade: 'A' },
  { maxScore: 25, grade: 'B' },
  { maxScore: 50, grade: 'C' },
  { maxScore: 75, grade: 'D' },
  { maxScore: 100, grade: 'F' },
] as const;

/** Minimum TiltScore (completely safe). */
export const TILT_SCORE_MIN = 0;

/** Maximum TiltScore (severe manipulation). */
export const TILT_SCORE_MAX = 100;

/** Default alert threshold for new projects. */
export const DEFAULT_ALERT_THRESHOLD = 40;

/**
 * Confidence floor — flags with confidence below this
 * value are discarded before scoring.
 */
export const CONFIDENCE_FLOOR = 0.3;

/**
 * Decay factor applied to older flags within the same conversation.
 * Ensures recent manipulations weigh more heavily.
 * Applied as: weight × (DECAY_FACTOR ^ flagAge), where flagAge is
 * the number of flags that came after this one.
 */
export const FLAG_DECAY_FACTOR = 0.85;

/**
 * Maximum number of flags that contribute to the TiltScore.
 * Prevents score inflation from many low-severity flags.
 */
export const MAX_SCORING_FLAGS = 20;

/**
 * Derives a letter grade from a numeric TiltScore.
 * @param tiltScore - The TiltScore value (0–100)
 * @returns The corresponding letter grade
 */
export function scoreToGrade(tiltScore: number): ScoreGrade {
  const clamped = Math.max(TILT_SCORE_MIN, Math.min(TILT_SCORE_MAX, tiltScore));
  for (const threshold of GRADE_THRESHOLDS) {
    if (clamped <= threshold.maxScore) {
      return threshold.grade;
    }
  }
  return 'F';
}

/**
 * Computes the TiltScore from an array of flag severity/confidence pairs.
 * Uses weighted severity with decay and clamping.
 *
 * @param flags - Array of objects containing severity and confidence
 * @returns The computed TiltScore (0–100)
 */
export function computeTiltScore(
  flags: ReadonlyArray<{ severity: FlagSeverity; confidence: number }>
): number {
  if (flags.length === 0) {
    return TILT_SCORE_MIN;
  }

  // Filter by confidence floor
  const qualifying = flags.filter((f) => f.confidence >= CONFIDENCE_FLOOR);

  if (qualifying.length === 0) {
    return TILT_SCORE_MIN;
  }

  // Sort by severity weight descending so highest-impact flags come first
  const sorted = [...qualifying].sort(
    (a, b) => SEVERITY_WEIGHTS[b.severity] - SEVERITY_WEIGHTS[a.severity]
  );

  // Take top N flags
  const scoring = sorted.slice(0, MAX_SCORING_FLAGS);

  // Compute weighted sum with decay
  let weightedSum = 0;
  for (let i = 0; i < scoring.length; i++) {
    const flag = scoring[i]!;
    const baseWeight = SEVERITY_WEIGHTS[flag.severity];
    const decayMultiplier = Math.pow(FLAG_DECAY_FACTOR, i);
    weightedSum += baseWeight * flag.confidence * decayMultiplier;
  }

  // Clamp to [0, 100]
  return Math.max(TILT_SCORE_MIN, Math.min(TILT_SCORE_MAX, Math.round(weightedSum)));
}
