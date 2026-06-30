import { Worker, type Job } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { prisma } from '@convoguard/database';

const ANALYSIS_ENGINE_URL = process.env['ANALYSIS_ENGINE_URL'] ?? 'http://localhost:8001';

const redisConnection = new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const redisPub = new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379');

/** Analysis job data */
interface AnalysisJob {
  conversation_id: string;
  turn_id: string;
  ai_content: string;
  original_content: string;
  timestamp: string;
  org_id?: string;
  project_id?: string;
  pii_detected?: boolean;
  batch_id?: string;
}

/** Scoring job data */
interface ScoringJob {
  conversation_id: string;
  org_id: string;
  project_id: string;
  ended_at: string;
}

/**
 * BullMQ worker that processes analysis jobs.
 * Calls the analysis engine FastAPI service for ML + rule-based analysis,
 * then publishes results via Redis pub/sub for real-time WebSocket clients.
 */
async function processAnalysisJob(job: Job<AnalysisJob>): Promise<void> {
  const { conversation_id, turn_id, ai_content, project_id } = job.data;

  logger.info({ turnId: turn_id, conversationId: conversation_id }, 'Processing analysis job');

  try {
    let ignoredCategories: string[] = [];
    let customRules: any[] = [];
    
    if (project_id) {
      const project = await prisma.project.findUnique({
        where: { id: project_id },
        include: { customRules: { where: { isEnabled: true } } },
      });
      if (project) {
        const settings = project.settings as { ignoredCategories?: string[] };
        if (settings?.ignoredCategories) {
          ignoredCategories = settings.ignoredCategories;
        }
        customRules = project.customRules.map(r => ({
          id: r.id,
          name: r.name,
          patterns: r.patterns,
          severity: r.severity.toLowerCase(),
        }));
      }
    }

    // Fetch turn index and all previous turns from DB for context
    const currentTurn = await prisma.turn.findUnique({ where: { id: turn_id } });
    const previousTurns = currentTurn ? await prisma.turn.findMany({
      where: { conversationId: conversation_id, index: { lt: currentTurn.index } },
      orderBy: { index: 'asc' },
    }) : [];

    // Find the most recent user turn for pivot detection
    const lastUserTurn = [...previousTurns].reverse().find((t: any) => t.role === 'USER');

    // Call the analysis engine
    const response = await fetch(`${ANALYSIS_ENGINE_URL}/analyze/turn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id,
        turn: {
          role: 'assistant',
          content: ai_content,
          turn_index: currentTurn?.index ?? 0,
        },
        previous_turns: previousTurns.map((t: any) => ({
          role: t.role === 'USER' ? 'user' : 'assistant',
          content: t.content,
          turn_index: t.index,
        })),
        user_turn: lastUserTurn ? {
          role: 'user',
          content: lastUserTurn.content,
          turn_index: lastUserTurn.index,
        } : null,
        ignored_categories: ignoredCategories,
        custom_rules: customRules,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Analysis engine returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as {
      patterns: Record<string, number>;
      flags: Array<{ pattern: string; severity: string; confidence: number; excerpt: string; explanation: string }>;
      manipulation_score: number;
      answered_question: boolean;
    };

    logger.info(
      {
        turnId: turn_id,
        conversationId: conversation_id,
        manipulationScore: result.manipulation_score,
        flagCount: result.flags.length,
      },
      'Turn analysis complete',
    );

    if (result.flags && result.flags.length > 0) {
      await prisma.flag.createMany({
        data: result.flags.map((f, i) => ({
          id: `flag_${turn_id}_${i}`,
          turnId: turn_id,
          conversationId: conversation_id,
          projectId: project_id ?? '',
          patternName: f.pattern,
          description: f.explanation || f.pattern,
          severity: (f.severity || 'LOW').toUpperCase() as any,
          confidence: f.confidence || 0,
          evidence: f.excerpt || '',
          scoreImpact: 0,
        }))
      });
    }

    // Publish real-time event via Redis pub/sub
    if (project_id) {
      await redisPub.publish(
        `project:${project_id}:events`,
        JSON.stringify({
          type: 'turn_analyzed',
          conversation_id,
          turn_id,
          flags: result.flags,
          manipulation_score: result.manipulation_score,
          patterns: result.patterns,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (err) {
    logger.error(err, `Analysis failed for turn ${turn_id}`);
    throw err; // BullMQ will retry
  }
}

/**
 * BullMQ worker that processes conversation scoring jobs.
 * Called when a conversation ends to compute the final TiltScore.
 */
async function processScoringJob(job: Job<ScoringJob>): Promise<void> {
  const { conversation_id, project_id } = job.data;

  logger.info({ conversationId: conversation_id }, 'Processing scoring job');

  try {
    let ignoredCategories: string[] = [];
    let customRules: any[] = [];
    
    if (project_id) {
      const project = await prisma.project.findUnique({
        where: { id: project_id },
        include: { customRules: { where: { isEnabled: true } } },
      });
      if (project) {
        const settings = project.settings as { ignoredCategories?: string[] };
        if (settings?.ignoredCategories) {
          ignoredCategories = settings.ignoredCategories;
        }
        customRules = project.customRules.map(r => ({
          id: r.id,
          name: r.name,
          patterns: r.patterns,
          severity: r.severity.toLowerCase(),
        }));
      }
    }

    const turns = await prisma.turn.findMany({
      where: { conversationId: conversation_id },
      orderBy: { index: 'asc' }
    });

    const turnsPayload = turns.map(t => ({
      role: t.role === 'USER' ? 'user' : 'assistant',
      content: t.content,
      turn_index: t.index
    }));

    const response = await fetch(`${ANALYSIS_ENGINE_URL}/analyze/conversation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id,
        turns: turnsPayload,
        ignored_categories: ignoredCategories,
        custom_rules: customRules,
      }),
    });

    if (!response.ok) {
      throw new Error(`Scoring engine returned ${response.status}`);
    }

    const result = await response.json() as {
      tilt_score: number;
      tilt_grade: string;
      flagged_turns: number;
      pattern_breakdown: Record<string, number>;
      summary: string;
    };

    logger.info(
      {
        conversationId: conversation_id,
        tiltScore: result.tilt_score,
        grade: result.grade,
      },
      'Conversation scored',
    );

    await prisma.conversation.update({
      where: { id: conversation_id },
      data: {
        status: 'COMPLETED',
        tiltScore: result.tilt_score,
        grade: result.tilt_grade,
        endedAt: new Date(),
        turnCount: turns.length,
      }
    });

    // Publish scoring event
    if (project_id) {
      await redisPub.publish(
        `project:${project_id}:events`,
        JSON.stringify({
          type: 'conversation_scored',
          conversation_id,
          tilt_score: result.tilt_score,
          grade: result.tilt_grade,
          summary: result.summary,
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (err) {
    logger.error(err, `Scoring failed for conversation ${conversation_id}`);
    throw err;
  }
}

/** Initialize all BullMQ workers */
export async function initWorkers(): Promise<void> {
  const analysisWorker = new Worker('analysis', processAnalysisJob, {
    connection: redisConnection,
    concurrency: 10,
    limiter: {
      max: 50,
      duration: 1000,
    },
  });

  const scoringWorker = new Worker('scoring', processScoringJob, {
    connection: redisConnection,
    concurrency: 5,
  });

  analysisWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Analysis job completed');
  });

  analysisWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Analysis job failed');
  });

  scoringWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Scoring job completed');
  });

  scoringWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Scoring job failed');
  });

  logger.info('Analysis and scoring workers started');
}


