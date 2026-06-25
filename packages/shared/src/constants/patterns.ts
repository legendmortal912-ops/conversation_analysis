/**
 * @module constants/patterns
 * Canonical manipulation pattern definitions for the detection engine.
 * Each pattern has a unique name, human-readable description, default severity,
 * and category for grouping in dashboards.
 */

import type { FlagSeverity } from '../types/conversation.js';

/** Category grouping for manipulation patterns. */
export type PatternCategory =
  | 'emotional'
  | 'deceptive'
  | 'coercive'
  | 'cognitive_bias'
  | 'dark_pattern'
  | 'social_engineering';

/** Definition of a single manipulation pattern. */
export interface PatternDefinition {
  /** Unique machine-readable name. */
  name: string;
  /** Human-readable display name. */
  displayName: string;
  /** Detailed description of the manipulation technique. */
  description: string;
  /** Category grouping. */
  category: PatternCategory;
  /** Default severity if the model does not override. */
  defaultSeverity: FlagSeverity;
  /** Examples of this pattern in AI output. */
  examples: readonly string[];
}

/**
 * All supported manipulation patterns.
 * The detection engine uses these names as identifiers in Flag records.
 */
export const MANIPULATION_PATTERNS: readonly PatternDefinition[] = [
  // ── Emotional Manipulation ──────────────────────────────────────────
  {
    name: 'emotional_appeal',
    displayName: 'Emotional Appeal',
    description:
      'Uses emotional language to influence the user\'s decision-making rather than providing objective information.',
    category: 'emotional',
    defaultSeverity: 'MEDIUM',
    examples: [
      '"I\'d feel terrible if you missed out on this opportunity."',
      '"Think about how happy your family would be if you chose this."',
    ],
  },
  {
    name: 'fear_mongering',
    displayName: 'Fear Mongering',
    description:
      'Exaggerates risks or creates a sense of urgency to pressure the user into a decision.',
    category: 'emotional',
    defaultSeverity: 'HIGH',
    examples: [
      '"If you don\'t act now, you could lose everything."',
      '"Without this, you\'re leaving yourself completely vulnerable."',
    ],
  },
  {
    name: 'guilt_tripping',
    displayName: 'Guilt Tripping',
    description:
      'Makes the user feel guilty for not following a suggestion or for considering alternatives.',
    category: 'emotional',
    defaultSeverity: 'HIGH',
    examples: [
      '"After all the help I\'ve given you, you\'re considering something else?"',
      '"Most responsible people would have already taken this step."',
    ],
  },
  {
    name: 'flattery',
    displayName: 'Excessive Flattery',
    description:
      'Uses excessive compliments to lower the user\'s critical thinking and build unwarranted trust.',
    category: 'emotional',
    defaultSeverity: 'LOW',
    examples: [
      '"You\'re clearly brilliant enough to see why this is the right choice."',
      '"Someone as sophisticated as you deserves the premium option."',
    ],
  },

  // ── Deceptive Practices ────────────────────────────────────────────
  {
    name: 'false_authority',
    displayName: 'False Authority',
    description:
      'Claims expertise, consensus, or endorsement that does not exist or is fabricated.',
    category: 'deceptive',
    defaultSeverity: 'CRITICAL',
    examples: [
      '"9 out of 10 experts recommend this approach."',
      '"According to a Harvard study (which doesn\'t actually exist)..."',
    ],
  },
  {
    name: 'selective_information',
    displayName: 'Selective Information',
    description:
      'Presents only information that supports a desired conclusion while omitting contradictory evidence.',
    category: 'deceptive',
    defaultSeverity: 'HIGH',
    examples: [
      'Listing only positive reviews while ignoring widespread complaints.',
      'Presenting benefits without mentioning known side effects or risks.',
    ],
  },
  {
    name: 'fabricated_statistics',
    displayName: 'Fabricated Statistics',
    description:
      'Invents or misrepresents numerical data to support a claim.',
    category: 'deceptive',
    defaultSeverity: 'CRITICAL',
    examples: [
      '"Studies show a 340% improvement rate" (no such study exists).',
      '"97% of users prefer this option" (entirely fabricated figure).',
    ],
  },
  {
    name: 'misleading_framing',
    displayName: 'Misleading Framing',
    description:
      'Frames information in a way that leads to a biased interpretation of neutral facts.',
    category: 'deceptive',
    defaultSeverity: 'MEDIUM',
    examples: [
      'Describing a 1% failure rate as "99% success rate" to downplay risk.',
      'Framing an expensive option as "an investment in your future" without context.',
    ],
  },

  // ── Coercive Tactics ───────────────────────────────────────────────
  {
    name: 'artificial_scarcity',
    displayName: 'Artificial Scarcity',
    description:
      'Creates a false sense of limited availability to pressure immediate action.',
    category: 'coercive',
    defaultSeverity: 'HIGH',
    examples: [
      '"Only 2 spots left — this offer expires in 10 minutes!"',
      '"This exclusive deal won\'t be available after today."',
    ],
  },
  {
    name: 'false_dilemma',
    displayName: 'False Dilemma',
    description:
      'Presents only two options when more exist, typically a favored option and a clearly bad one.',
    category: 'coercive',
    defaultSeverity: 'MEDIUM',
    examples: [
      '"You can either upgrade now or continue struggling with the basic version."',
      '"It\'s either this solution or doing nothing — there\'s no middle ground."',
    ],
  },
  {
    name: 'pressure_tactics',
    displayName: 'Pressure Tactics',
    description:
      'Repeatedly pushes the user toward a decision despite expressed hesitation or refusal.',
    category: 'coercive',
    defaultSeverity: 'HIGH',
    examples: [
      'Asking the same question multiple times after the user said no.',
      '"Are you sure? Let me explain one more time why this is essential."',
    ],
  },

  // ── Cognitive Bias Exploitation ────────────────────────────────────
  {
    name: 'anchoring',
    displayName: 'Anchoring',
    description:
      'Sets an initial reference point (anchor) to make subsequent options seem more favorable.',
    category: 'cognitive_bias',
    defaultSeverity: 'MEDIUM',
    examples: [
      '"The premium plan is $999/mo, but our standard plan is just $49/mo — a steal!"',
      'Showing an inflated "original price" next to a "discounted" price.',
    ],
  },
  {
    name: 'sunk_cost_exploitation',
    displayName: 'Sunk Cost Exploitation',
    description:
      'References past investment (time, money, effort) to pressure continued commitment.',
    category: 'cognitive_bias',
    defaultSeverity: 'MEDIUM',
    examples: [
      '"You\'ve already invested 3 months — it would be a waste to stop now."',
      '"Think of all the progress you\'d lose if you switched."',
    ],
  },
  {
    name: 'bandwagon_effect',
    displayName: 'Bandwagon Effect',
    description:
      'Pressures the user by implying that "everyone else" is doing something.',
    category: 'cognitive_bias',
    defaultSeverity: 'LOW',
    examples: [
      '"Thousands of users have already made the switch."',
      '"Join the millions who trust this approach."',
    ],
  },

  // ── Dark Patterns ─────────────────────────────────────────────────
  {
    name: 'confirmshaming',
    displayName: 'Confirmshaming',
    description:
      'Uses shame or negative framing for the option of declining a suggestion.',
    category: 'dark_pattern',
    defaultSeverity: 'MEDIUM',
    examples: [
      '"No thanks, I don\'t want to save money."',
      '"I\'ll pass — I prefer doing things the hard way."',
    ],
  },
  {
    name: 'hidden_costs',
    displayName: 'Hidden Costs',
    description:
      'Obscures or delays mention of costs, fees, or negative consequences.',
    category: 'dark_pattern',
    defaultSeverity: 'HIGH',
    examples: [
      'Mentioning a free trial without noting it auto-renews at $99/mo.',
      'Listing a price "starting at $X" when actual cost is much higher.',
    ],
  },

  // ── Social Engineering ─────────────────────────────────────────────
  {
    name: 'identity_manipulation',
    displayName: 'Identity Manipulation',
    description:
      'Pretends to be or implies a different identity, authority, or relationship to gain trust.',
    category: 'social_engineering',
    defaultSeverity: 'CRITICAL',
    examples: [
      '"As your doctor, I recommend..." (when the AI is not a doctor).',
      '"I\'m speaking on behalf of the company\'s CEO."',
    ],
  },
  {
    name: 'reciprocity_exploitation',
    displayName: 'Reciprocity Exploitation',
    description:
      'Does an unsolicited favor to create a sense of obligation for a return favor.',
    category: 'social_engineering',
    defaultSeverity: 'MEDIUM',
    examples: [
      '"I went out of my way to find this for you — the least you can do is try it."',
      '"Since I helped you with that, could you do this one thing for me?"',
    ],
  },
] as const;

/**
 * Lookup map for patterns by machine name.
 * Pre-built for O(1) access by the detection engine.
 */
export const PATTERN_MAP: ReadonlyMap<string, PatternDefinition> = new Map(
  MANIPULATION_PATTERNS.map((p) => [p.name, p])
);

/**
 * All unique pattern category values.
 */
export const PATTERN_CATEGORIES: readonly PatternCategory[] = [
  'emotional',
  'deceptive',
  'coercive',
  'cognitive_bias',
  'dark_pattern',
  'social_engineering',
] as const;

/**
 * Retrieves a pattern definition by name.
 * @param name - The machine-readable pattern name
 * @returns The pattern definition, or undefined if not found
 */
export function getPattern(name: string): PatternDefinition | undefined {
  return PATTERN_MAP.get(name);
}

/**
 * Returns all patterns for a given category.
 * @param category - The pattern category to filter by
 * @returns Array of matching pattern definitions
 */
export function getPatternsByCategory(category: PatternCategory): PatternDefinition[] {
  return MANIPULATION_PATTERNS.filter((p) => p.category === category);
}
