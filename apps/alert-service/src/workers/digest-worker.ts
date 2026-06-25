import { Worker, type Job } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { emailChannel } from '../channels/email.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Worker that generates and sends a daily digest email to org owners/admins.
 */
export async function processDigestJob(job: Job): Promise<void> {
  logger.info('Running daily digest job');

  const orgs = await prisma.organization.findMany({
    include: {
      users: {
        where: { role: { in: ['OWNER', 'ADMIN'] } },
      },
      projects: true,
    },
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  for (const org of orgs) {
    if (org.users.length === 0) continue;

    let totalConversations = 0;
    let totalFlags = 0;
    let averageTilt = 0;

    const projectStats = await Promise.all(
      org.projects.map(async (project) => {
        const convs = await prisma.conversation.findMany({
          where: {
            projectId: project.id,
            startedAt: { gte: yesterday },
          },
          select: { tiltScore: true, flagCount: true },
        });

        const count = convs.length;
        const flags = convs.reduce((sum, c) => sum + c.flagCount, 0);
        const avgScore = count > 0 
          ? Math.round(convs.reduce((sum, c) => sum + (c.tiltScore ?? 100), 0) / count)
          : 100;

        totalConversations += count;
        totalFlags += flags;
        averageTilt += avgScore;

        return {
          name: project.name,
          count,
          flags,
          avgScore,
        };
      })
    );

    if (totalConversations === 0) continue; // Skip if no activity

    const overallAvg = Math.round(averageTilt / org.projects.length);
    const emails = org.users.map((u) => u.email);

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>ConvoGuard Daily Digest — ${org.name}</h2>
        <p>Here is your summary for the last 24 hours:</p>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px;">
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #0f172a;">${totalConversations}</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Conversations</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${totalFlags}</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Flags Detected</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #6366f1;">${overallAvg}</div>
            <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Avg TiltScore</div>
          </div>
        </div>

        <h3>Project Breakdown</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid #e2e8f0; text-align: left;">
              <th style="padding: 8px 0; color: #64748b;">Project</th>
              <th style="padding: 8px 0; color: #64748b;">Conversations</th>
              <th style="padding: 8px 0; color: #64748b;">Flags</th>
              <th style="padding: 8px 0; color: #64748b;">Avg Score</th>
            </tr>
          </thead>
          <tbody>
            ${projectStats.map(s => `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; font-weight: 500;">${s.name}</td>
                <td style="padding: 8px 0;">${s.count}</td>
                <td style="padding: 8px 0;">${s.flags}</td>
                <td style="padding: 8px 0;">${s.avgScore}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <p style="margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center;">
          <a href="${process.env['FRONTEND_URL']}" style="color: #6366f1; text-decoration: none;">View full dashboard</a>
        </p>
      </div>
    `;

    try {
      await emailChannel.send(emails, `ConvoGuard Daily Digest - ${totalFlags} flags detected`, html);
    } catch (err) {
      logger.error({ err, orgId: org.id }, 'Failed to send digest email');
    }
  }

  logger.info('Daily digest job completed');
}

