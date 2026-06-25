import { PrismaClient } from '@prisma/client';
import { PLANS } from '@convoguard/shared';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export interface UsageReport {
  orgId: string;
  plan: string;
  turnsUsed: number;
  turnsLimit: number | null;
  percentageUsed: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Calculates current usage for an organization based on their active plan.
 */
export async function getUsage(orgId: string): Promise<UsageReport> {
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new Error('Organization not found');

  const planId = org.plan as keyof typeof PLANS;
  const plan = PLANS[planId] ?? PLANS.FREE;

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const usageEvents = await prisma.usageEvent.findMany({
    where: {
      orgId,
      eventType: 'TURN_PROCESSED',
      periodStart: { gte: periodStart },
    },
  });

  const turnsUsed = usageEvents.reduce((sum, event) => sum + event.quantity, 0);
  const turnsLimit = plan.turnLimit;
  const percentageUsed = turnsLimit === null ? 0 : Math.min(100, Math.round((turnsUsed / turnsLimit) * 100));

  return {
    orgId,
    plan: plan.name,
    turnsUsed,
    turnsLimit,
    percentageUsed,
    periodStart,
    periodEnd,
  };
}

/**
 * Checks if an organization is allowed to ingest another turn.
 */
export async function canIngestTurn(orgId: string): Promise<boolean> {
  const usage = await getUsage(orgId);
  if (usage.turnsLimit === null) return true;
  return usage.turnsUsed < usage.turnsLimit;
}
