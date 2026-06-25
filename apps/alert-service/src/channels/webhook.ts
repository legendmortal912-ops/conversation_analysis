import { logger } from '../utils/logger.js';

export class WebhookChannel {
  async send(url: string, payload: Record<string, unknown>, secret?: string): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'ConvoGuard-Alert-Webhook/1.0',
      };

      if (secret) {
        // Implement HMAC signature if needed in production
        headers['X-ConvoGuard-Signature'] = 'TODO';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }

      logger.info({ url }, 'Webhook alert delivered');
    } catch (err) {
      logger.error({ err, url }, 'Failed to deliver webhook alert');
      throw err;
    }
  }
}

export const webhookChannel = new WebhookChannel();
