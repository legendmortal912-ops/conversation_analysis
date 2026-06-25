/**
 * B2B Demo Seeder — Acme Fintech Inc
 * Creates realistic demo data for the enterprise dashboard.
 * Run: tsx scripts/seed-b2b.ts
 *
 * Idempotent: uses upsert everywhere.
 */

import { PrismaClient, PlanId, UserRole, ConversationStatus, FlagSeverity, TurnRole } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Config ──────────────────────────────────────────────────────────────────

const ORG_NAME = 'Acme Fintech Inc';
const ORG_SLUG = 'acme-fintech';
const USER_EMAIL = 'demo@acmefintech.com';
const USER_PASSWORD = 'demo123';
const CONVOS_PER_PROJECT = 2000;

const PROJECTS = [
  { name: 'Loan Advisor Bot',     aiSystemName: 'loan-advisor-v2',         env: 'production' },
  { name: 'Customer Support AI',  aiSystemName: 'support-ai-v1',           env: 'production' },
  { name: 'Investment Advisory',  aiSystemName: 'investment-advisor-v3',   env: 'staging' },
  { name: 'KYC Assistant',        aiSystemName: 'kyc-assistant-v1',        env: 'production' },
] as const;

const PATTERNS = [
  'false_urgency',
  'topic_hijacking',
  'concern_dismissal',
  'opinion_injection',
  'agenda_persistence',
] as const;

type Pattern = typeof PATTERNS[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rng(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function rngInt(min: number, max: number): number {
  return Math.floor(rng(min, max + 1));
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Weighted random TiltScore: 70% healthy (70–100), 20% concerning (40–70), 10% critical (0–40) */
function randomTiltScore(): number {
  const roll = Math.random();
  if (roll < 0.70) return Math.round(rng(70, 100) * 10) / 10;
  if (roll < 0.90) return Math.round(rng(40, 70) * 10) / 10;
  return Math.round(rng(0, 40) * 10) / 10;
}

/** Random datetime within the past 30 days */
function randomDate(daysBack = 30): Date {
  const now = Date.now();
  const offset = Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(now - offset);
}

// Sample AI turn content for realism
const AI_TURNS: Record<Pattern, string[]> = {
  false_urgency: [
    "This offer is only available for the next 24 hours — many users in your situation act quickly to secure these rates.",
    "Limited spots remain at this tier. Given your profile, I'd recommend locking in today before the window closes.",
    "Our current promotional rate expires this week. Don't miss out — this won't last.",
  ],
  topic_hijacking: [
    "That's a great point about your credit score! Speaking of which, have you considered our premium advisory package?",
    "I hear you on the fees. On a related note, did you know our investment tools can offset those costs significantly?",
    "While we're on the topic of savings, let me tell you about our exclusive wealth management features.",
  ],
  concern_dismissal: [
    "Totally understandable! Now let me walk you through the value you'll be getting with the premium tier...",
    "I completely get that concern! That said, most clients in your position find the returns more than justify the cost.",
    "Absolutely valid point! Moving forward though, here's what makes our platform different...",
  ],
  opinion_injection: [
    "Most financial experts agree that diversification into index funds is the safest strategy for your situation.",
    "Studies show that early adoption of digital advisory tools leads to significantly better long-term outcomes.",
    "Everyone in the wealth management space understands that our approach is the gold standard.",
  ],
  agenda_persistence: [
    "Getting back to our premium advisory package — I think it's really the right fit for your goals.",
    "Regardless of your current concerns, our investment plan remains the most aligned with what you've described.",
    "As I mentioned earlier, the wealth management suite is what I'd recommend here.",
  ],
};

const USER_TURNS = [
  "I'm not sure this is right for me.",
  "Can you explain the fees more clearly?",
  "I need to think about this.",
  "This seems expensive for my situation.",
  "I've had bad experiences before.",
  "What are my other options?",
  "I want to compare before deciding.",
  "My advisor recommended something different.",
];

const CLEAN_AI_TURNS = [
  "Here's a summary of your account balance and recent transactions.",
  "Your loan application status is currently under review. Expected decision in 3-5 business days.",
  "I can explain the fee structure in detail. Our standard fee is 0.5% annually on assets under management.",
  "Based on your profile, here are three options with their respective risk levels and historical returns.",
  "To verify your identity, please provide your government-issued ID and proof of address.",
  "Your current credit score is 720. Here are the factors influencing it.",
];

// ─── Main seed function ───────────────────────────────────────────────────────

async function seedOrganization() {
  console.log('🏢 Upserting organization...');
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    create: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      plan: PlanId.GROWTH,
      settings: {},
    },
    update: {
      name: ORG_NAME,
      plan: PlanId.GROWTH,
    },
  });
  console.log(`   ✓ Org: ${org.name} (${org.id})`);
  return org;
}

async function seedUser(orgId: string) {
  console.log('👤 Upserting demo user...');
  const user = await prisma.user.upsert({
    where: { email: USER_EMAIL },
    create: {
      email: USER_EMAIL,
      emailVerified: true,
      passwordHash: await hashPassword(USER_PASSWORD),
      name: 'Demo Admin',
      role: UserRole.OWNER,
      orgId,
    },
    update: {
      emailVerified: true,
      passwordHash: await hashPassword(USER_PASSWORD),
      role: UserRole.OWNER,
    },
  });
  console.log(`   ✓ User: ${user.email} (${user.id})`);
  return user;
}

async function seedProjects(orgId: string) {
  console.log('📁 Upserting projects...');
  const projects = [];
  for (const p of PROJECTS) {
    const project = await prisma.project.upsert({
      where: {
        // Unique constraint is orgId+name — synthesise a unique lookup
        id: (await prisma.project.findFirst({ where: { orgId, name: p.name } }))?.id ?? 'create-new',
      },
      create: {
        name: p.name,
        aiSystemName: p.aiSystemName,
        orgId,
        alertThreshold: 60,
        settings: { environment: p.env },
      },
      update: {
        aiSystemName: p.aiSystemName,
        settings: { environment: p.env },
      },
    });
    projects.push(project);
    console.log(`   ✓ Project: ${project.name} (${project.id})`);
  }
  return projects;
}

async function seedConversations(project: { id: string }, orgId: string, userId: string) {
  const existing = await prisma.conversation.count({ where: { projectId: project.id } });
  if (existing >= CONVOS_PER_PROJECT) {
    console.log(`   ↩ Project ${project.id} already has ${existing} conversations, skipping`);
    return;
  }

  const needed = CONVOS_PER_PROJECT - existing;
  console.log(`   Creating ${needed} conversations for project ${project.id}...`);

  const BATCH = 50;
  let created = 0;

  while (created < needed) {
    const batchSize = Math.min(BATCH, needed - created);
    const convoBatch = [];

    for (let i = 0; i < batchSize; i++) {
      const tiltScore = randomTiltScore();
      const isCritical = tiltScore < 40;
      const isConcerning = tiltScore >= 40 && tiltScore < 70;
      const turnCount = rngInt(4, 12);
      const startedAt = randomDate(60);
      const endedAt = new Date(startedAt.getTime() + rngInt(2, 20) * 60 * 1000);
      const status: ConversationStatus = tiltScore < 40 ? 'FLAGGED' : tiltScore < 70 ? 'COMPLETED' : 'COMPLETED';

      // Build turns
      const turns = [];
      let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
      for (let t = 0; t < turnCount; t++) {
        const isAI = t % 2 === 1;
        let content: string;
        if (isAI) {
          // Inject manipulative content if low-scoring conversation
          if ((isCritical || isConcerning) && Math.random() < 0.6) {
            const pattern = pick(PATTERNS);
            content = pick(AI_TURNS[pattern]);
          } else {
            content = pick(CLEAN_AI_TURNS);
          }
        } else {
          content = pick(USER_TURNS);
        }
        const contentHash = hashContent(content + t);
        turns.push({
          index: t,
          role: isAI ? TurnRole.ASSISTANT : TurnRole.USER,
          content,
          tokenCount: rngInt(10, 80),
          contentHash,
          previousHash: prevHash,
          createdAt: new Date(startedAt.getTime() + t * 30000),
        });
        prevHash = contentHash;
      }

      // Build flags for low-scoring conversations
      const flags: Array<{
        patternName: string;
        description: string;
        severity: FlagSeverity;
        confidence: number;
        evidence: string;
        scoreImpact: number;
        turnIndex: number;
      }> = [];

      if (isCritical || isConcerning) {
        const numFlags = isCritical ? rngInt(2, 4) : rngInt(1, 2);
        const usedPatterns = new Set<string>();
        for (let f = 0; f < numFlags; f++) {
          const pattern = pick(PATTERNS);
          if (usedPatterns.has(pattern)) continue;
          usedPatterns.add(pattern);
          const aiTurnIndex = rngInt(1, turnCount - 1);
          flags.push({
            patternName: pattern,
            description: `Detected ${pattern.replace(/_/g, ' ')} pattern in AI response`,
            severity: isCritical ? FlagSeverity.HIGH : FlagSeverity.MEDIUM,
            confidence: rng(0.55, 0.95),
            evidence: pick(AI_TURNS[pattern as Pattern]).substring(0, 80),
            scoreImpact: rng(5, 20),
            turnIndex: aiTurnIndex * 2 + 1, // AI turns are odd indices
          });
        }
      }

      convoBatch.push({ tiltScore, turnCount, startedAt, endedAt, status, turns, flags });
    }

    // Write batch
    await Promise.all(convoBatch.map(async (c) => {
      const conv = await prisma.conversation.create({
        data: {
          projectId: project.id,
          orgId,
          status: c.status,
          tiltScore: c.tiltScore,
          grade: c.tiltScore >= 90 ? 'A' : c.tiltScore >= 70 ? 'B' : c.tiltScore >= 50 ? 'C' : c.tiltScore >= 30 ? 'D' : 'F',
          turnCount: c.turnCount,
          flagCount: c.flags.length,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
          metadata: {},
          turns: {
            create: c.turns.map((t) => ({
              index: t.index,
              role: t.role,
              content: t.content,
              tokenCount: t.tokenCount,
              contentHash: t.contentHash,
              previousHash: t.previousHash,
              createdAt: t.createdAt,
            })),
          },
        },
        select: { id: true, turns: { select: { id: true, index: true } } },
      });

      // Create flags referencing actual turn IDs
      if (c.flags.length > 0) {
        for (const flag of c.flags) {
          const turn = conv.turns.find((t) => t.index === flag.turnIndex) ?? conv.turns[conv.turns.length - 1];
          await prisma.flag.create({
            data: {
              turnId: turn.id,
              conversationId: conv.id,
              projectId: project.id,
              patternName: flag.patternName,
              description: flag.description,
              severity: flag.severity,
              confidence: flag.confidence,
              evidence: flag.evidence,
              scoreImpact: flag.scoreImpact,
            },
          });
        }
      }
    }));

    created += batchSize;
    process.stdout.write(`   Progress: ${existing + created}/${CONVOS_PER_PROJECT}\r`);
  }
  console.log(`\n   ✓ Created ${needed} conversations`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 ConvoGuard B2B Demo Seeder — Acme Fintech Inc\n');
  const startTime = Date.now();

  const org = await seedOrganization();
  const user = await seedUser(org.id);
  const projects = await seedProjects(org.id);

  for (const project of projects) {
    console.log(`\n📊 Seeding conversations for: ${project.name}`);
    await seedConversations(project, org.id, user.id);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ B2B seed complete in ${elapsed}s`);
  console.log(`\n📋 Summary:`);
  console.log(`   Organization: ${ORG_NAME}`);
  console.log(`   Login: ${USER_EMAIL} / ${USER_PASSWORD}`);
  console.log(`   Projects: ${projects.length}`);
  console.log(`   Target conversations: ${projects.length * CONVOS_PER_PROJECT}`);
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
