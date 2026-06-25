/**
 * @module billing
 * Plan, UsageEvent, and BillingEvent types for metered billing.
 */

import type { PlanId } from './organization.js';

/** Billable event types tracked by the usage metering system. */
export type UsageEventType =
  | 'CONVERSATION_CREATED'
  | 'TURN_PROCESSED'
  | 'FLAG_DETECTED'
  | 'TOKENS_PROCESSED'
  | 'API_CALL';

/** Billing event types emitted to Stripe or internal ledger. */
export type BillingEventType =
  | 'subscription_created'
  | 'subscription_updated'
  | 'subscription_cancelled'
  | 'invoice_paid'
  | 'invoice_failed'
  | 'usage_reported'
  | 'plan_upgraded'
  | 'plan_downgraded';

/**
 * Defines a billing plan's limits and pricing.
 */
export interface Plan {
  /** Plan identifier. */
  id: PlanId;
  /** Human-readable name. */
  name: string;
  /** Monthly price in USD cents (0 for free). */
  priceMonthly: number;
  /** Annual price in USD cents (0 for free). */
  priceAnnual: number;
  /** Maximum conversations per month (null = unlimited). */
  maxConversationsPerMonth: number | null;
  /** Maximum projects allowed. */
  maxProjects: number;
  /** Maximum team members (users). */
  maxTeamMembers: number;
  /** Maximum API keys. */
  maxApiKeys: number;
  /** Data retention in days. */
  retentionDays: number;
  /** Whether real-time alerting is available. */
  alertsEnabled: boolean;
  /** Whether webhook integrations are available. */
  webhooksEnabled: boolean;
  /** Whether the hash-chain audit trail is available. */
  auditTrailEnabled: boolean;
  /** Whether custom report generation is available. */
  customReportsEnabled: boolean;
  /** Whether SSO login is available. */
  ssoEnabled: boolean;
  /** Whether a dedicated support channel is available. */
  dedicatedSupport: boolean;
  /** Stripe Price ID for billing. */
  stripePriceId?: string;
  /** Maximum turns per month. */
  turnLimit: number | null;
  /**
   * Whether this plan is eligible for on-premise deployment.
   * FREE and STARTER tiers are SaaS-only. GROWTH and ENTERPRISE
   * can download a license.jwt and run the engine on their own infra.
   */
  onPremEligible: boolean;
}

/**
 * A metered usage event for billing purposes.
 * Accumulated and reported to Stripe at the end of each billing period.
 */
export interface UsageEvent {
  /** Unique identifier (nanoid). */
  id: string;
  /** Organization being billed. */
  orgId: string;
  /** Project that generated this usage (optional). */
  projectId: string | null;
  /** Type of billable event. */
  eventType: UsageEventType;
  /** Quantity (e.g. number of tokens, number of conversations). */
  quantity: number;
  /** ISO-8601 billing period start. */
  periodStart: string;
  /** ISO-8601 billing period end. */
  periodEnd: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

/**
 * A billing lifecycle event for audit and webhook delivery.
 */
export interface BillingEvent {
  /** Unique identifier (nanoid). */
  id: string;
  /** Organization. */
  orgId: string;
  /** Event type. */
  eventType: BillingEventType;
  /** Stripe event ID (if originating from Stripe webhook). */
  stripeEventId: string | null;
  /** Arbitrary event payload. */
  data: Record<string, unknown>;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}
