/**
 * @module organization
 * Organization, User, Project, and ApiKey domain types.
 */

import type { Role } from './auth.js';

/** Top-level billing plan identifiers. */
export type PlanId = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

/** Organization — the top-level tenant in ConvoGuard. */
export interface Organization {
  /** Unique identifier (nanoid). */
  id: string;
  /** Human-readable organization name. */
  name: string;
  /** URL-friendly slug derived from the name. */
  slug: string;
  /** Stripe customer ID for billing integration. */
  stripeCustomerId: string | null;
  /** Active billing plan. */
  plan: PlanId;
  /** Arbitrary JSON settings specific to the org. */
  settings: Record<string, unknown>;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** A user within an organization. */
export interface User {
  /** Unique identifier (nanoid). */
  id: string;
  /** User email (unique across the platform). */
  email: string;
  /** bcrypt password hash — never exposed to clients. */
  passwordHash: string;
  /** Display name. */
  name: string;
  /** Role within the organization. */
  role: Role;
  /** Organization this user belongs to. */
  orgId: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** Publicly-safe subset of User (no passwordHash). */
export type SafeUser = Omit<User, 'passwordHash'>;

/** A project groups conversations under a specific AI system being monitored. */
export interface Project {
  /** Unique identifier (nanoid). */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Name of the AI system being monitored (e.g. "GPT-4 Support Bot"). */
  aiSystemName: string;
  /** Organization this project belongs to. */
  orgId: string;
  /** TiltScore threshold that triggers alerts (0–100). */
  alertThreshold: number;
  /** Arbitrary JSON settings specific to the project. */
  settings: Record<string, unknown>;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** API key used for programmatic SDK access. */
export interface ApiKey {
  /** Unique identifier (nanoid). */
  id: string;
  /** SHA-256 hash of the full key — the actual key is never stored. */
  keyHash: string;
  /** First 8 characters of the key for display (e.g. "cg_live_Ab"). */
  keyPrefix: string;
  /** Friendly label for the key. */
  name: string;
  /** Organization this key belongs to. */
  orgId: string;
  /** Optional project scope — if set, limits key to one project. */
  projectId: string | null;
  /** User who created this key. */
  createdById: string;
  /** ISO-8601 timestamp of last use, or null if never used. */
  lastUsedAt: string | null;
  /** ISO-8601 timestamp when revoked, or null if active. */
  revokedAt: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/** Severity levels for custom rules. */
export type FlagSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** A custom rule allows organizations to define their own pattern matching using regex. */
export interface CustomRule {
  /** Unique identifier (cuid). */
  id: string;
  /** Project this rule belongs to. */
  projectId: string;
  /** Name of the custom category/rule. */
  name: string;
  /** Optional description. */
  description: string | null;
  /** Array of regex patterns to match. */
  patterns: string[];
  /** Severity level if the rule is triggered. */
  severity: FlagSeverity;
  /** Whether the rule is currently active. */
  isEnabled: boolean;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/** Project Settings with custom rules configuration. */
export interface ProjectSettings {
  /** List of standard categories to ignore. */
  ignoredCategories?: string[];
  [key: string]: unknown;
}
