import { Worker, type Job } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { emailChannel } from '../channels/email.js';
import { slackChannel } from '../channels/slack.js';
import { webhookChannel } from '../channels/webhook.js';
import { checkAndSetDedup, checkRateLimit } from '../deduplication.js';
import { PrismaClient } from '@prisma/client';

const redisConnection = new IORedis(process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

interface AlertJobData {
  alert_id: string;
  project_id: string;
  org_id: string;
  alert_type: string; // 'threshold', 'spike', 'surge', 'critical_flag'
  message: string;
  entity_id: string; // e.g., conversation_id
}

/**
 * Worker that processes alert delivery jobs.
 * Fetches configured channels for the project, checks deduplication and rate limits,
 * then delivers the alert via the appropriate channels.
 */
export async function processAlertJob(job: Job<AlertJobData>): Promise<void> {
  const { alert_id, project_id, alert_type, message, entity_id } = job.data;

  logger.info({ alert_id, project_id, alert_type }, 'Processing alert job');

  // 1. Deduplication (don't alert on the same issue for the same entity multiple times)
  const isNew = await checkAndSetDedup(project_id, alert_type, entity_id);
  if (!isNew) {
    logger.info({ alert_id }, 'Alert deduplicated (skipped)');
    await prisma.alert.update({
      where: { id: alert_id },
      data: { status: 'SKIPPED_DEDUP' },
    });
    return;
  }

  // 2. Rate limiting (max 10 alerts per hour per project by default)
  const underLimit = await checkRateLimit(project_id, 10);
  if (!underLimit) {
    logger.warn({ alert_id, project_id }, 'Alert rate limited (skipped)');
    await prisma.alert.update({
      where: { id: alert_id },
      data: { status: 'SKIPPED_RATELIMIT' },
    });
    return;
  }

  // 3. Fetch alert configuration for the project
  const config = await prisma.alertConfig.findFirst({
    where: { projectId: project_id, enabled: true },
  });

  if (!config || !config.channel) {
    logger.info({ project_id }, 'No active alert channels configured');
    await prisma.alert.update({
      where: { id: alert_id },
      data: { status: 'DELIVERED' }, // Technically delivered to nowhere
    });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: project_id } });
  const projectName = project?.name ?? 'Unknown Project';

  // 4. Deliver via configured channel
  const deliveryPromises = [(async () => {
    const channelType = config.channel;
    try {
      switch (channelType) {
        case 'EMAIL':
          if (config.emailAddresses && config.emailAddresses.length > 0) {
            await emailChannel.send(
              config.emailAddresses,
              `[ConvoGuard Alert] ${alert_type} detected in ${projectName}`,
              `<div style="font-family: sans-serif;">
                <h2>ConvoGuard Alert</h2>
                <p><strong>Project:</strong> ${projectName}</p>
                <p><strong>Type:</strong> ${alert_type}</p>
                <p><strong>Message:</strong> ${message}</p>
                <p><a href="${process.env['FRONTEND_URL']}/projects/${project_id}/alerts">View in Dashboard</a></p>
              </div>`
            );
          }
          break;

        case 'SLACK':
          if (config.slackWebhookUrl) {
            await slackChannel.send(config.slackWebhookUrl, {
              text: `*ConvoGuard Alert: ${projectName}*\n${message}`,
            });
          }
          break;

        case 'WEBHOOK':
          if (config.webhookUrl) {
            await webhookChannel.send(
              config.webhookUrl,
              {
                alert_id,
                project_id,
                alert_type,
                message,
                entity_id,
                timestamp: new Date().toISOString(),
              },
              undefined // Assuming no secret stored in config right now
            );
          }
          break;
      }
    } catch (err) {
      logger.error({ err, channelType }, 'Failed to deliver alert to channel');
    }
  })()];

  await Promise.allSettled(deliveryPromises);

  // 5. Update alert status
  await prisma.alert.update({
    where: { id: alert_id },
    data: { status: 'DELIVERED' },
  });

  logger.info({ alert_id }, 'Alert delivered successfully');
}


