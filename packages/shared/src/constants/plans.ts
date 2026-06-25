/**
 * @module constants/plans
 * Billing plan definitions with feature limits for each tier.
 */

import type { Plan } from '../types/billing.js';

/** Free tier — for evaluation and small personal projects. */
export const FREE_PLAN: Plan = {
  id: 'FREE',
  name: 'Free',
  priceMonthly: 0,
  priceAnnual: 0,
  maxConversationsPerMonth: 100,
  maxProjects: 1,
  maxTeamMembers: 1,
  maxApiKeys: 2,
  retentionDays: 7,
  alertsEnabled: false,
  webhooksEnabled: false,
  auditTrailEnabled: false,
  customReportsEnabled: false,
  ssoEnabled: false,
  dedicatedSupport: false,
  turnLimit: 10_000,
  onPremEligible: false, // SaaS only
};

/** Starter tier — for small teams getting started with monitoring. */
export const STARTER_PLAN: Plan = {
  id: 'STARTER',
  name: 'Starter',
  priceMonthly: 4900, // $49/mo
  priceAnnual: 47000, // $470/yr (~20% discount)
  maxConversationsPerMonth: 5_000,
  maxProjects: 3,
  maxTeamMembers: 5,
  maxApiKeys: 10,
  retentionDays: 30,
  alertsEnabled: true,
  webhooksEnabled: true,
  auditTrailEnabled: false,
  customReportsEnabled: false,
  ssoEnabled: false,
  dedicatedSupport: false,
  turnLimit: 100_000,
  stripePriceId: 'price_starter',
  onPremEligible: false, // SaaS only
};

/** Growth tier — for scaling teams that need full analytics. */
export const GROWTH_PLAN: Plan = {
  id: 'GROWTH',
  name: 'Growth',
  priceMonthly: 19900, // $199/mo
  priceAnnual: 190000, // $1,900/yr (~20% discount)
  maxConversationsPerMonth: 50_000,
  maxProjects: 10,
  maxTeamMembers: 25,
  maxApiKeys: 50,
  retentionDays: 90,
  alertsEnabled: true,
  webhooksEnabled: true,
  auditTrailEnabled: true,
  customReportsEnabled: true,
  ssoEnabled: false,
  dedicatedSupport: false,
  turnLimit: 1_000_000,
  stripePriceId: 'price_growth',
  onPremEligible: true, // On-Prem eligible
};

/** Enterprise tier — unlimited usage with premium support. */
export const ENTERPRISE_PLAN: Plan = {
  id: 'ENTERPRISE',
  name: 'Enterprise',
  priceMonthly: 0, // custom pricing
  priceAnnual: 0, // custom pricing
  maxConversationsPerMonth: null, // unlimited
  maxProjects: null,
  maxTeamMembers: null,
  maxApiKeys: null,
  retentionDays: null, // unlimited retention
  alertsEnabled: true,
  webhooksEnabled: true,
  auditTrailEnabled: true,
  customReportsEnabled: true,
  ssoEnabled: true,
  dedicatedSupport: true,
  turnLimit: null, // unlimited — billed via Merkle heartbeat telemetry
  onPremEligible: true, // On-Prem eligible with dedicated SLA
};

/** All plans indexed by plan ID for easy lookup. */
export const PLANS: Record<string, Plan> = {
  FREE: FREE_PLAN,
  STARTER: STARTER_PLAN,
  GROWTH: GROWTH_PLAN,
  ENTERPRISE: ENTERPRISE_PLAN,
} as const;

/**
 * Retrieves the plan definition for a given plan ID.
 * @param planId - The plan identifier
 * @returns The plan definition, or undefined if not found
 */
export function getPlan(planId: string): Plan | undefined {
  return PLANS[planId];
}
