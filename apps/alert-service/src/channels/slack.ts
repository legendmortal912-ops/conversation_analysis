import { logger } from '../utils/logger.js';

export class SlackChannel {
  async send(webhookUrl: string, message: { text: string; blocks?: unknown[] }): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.status} ${response.statusText}`);
      }

      logger.info('Slack alert sent successfully');
    } catch (err) {
      logger.error(err, 'Failed to send Slack alert');
      throw err;
    }
  }
}

export const slackChannel = new SlackChannel();
