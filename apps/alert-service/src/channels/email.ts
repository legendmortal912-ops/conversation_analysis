import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../utils/logger.js';

class EmailChannel {
  private transporter: Transporter | null = null;
  private readonly from: string;

  constructor() {
    this.from = process.env['SMTP_FROM'] ?? 'noreply@convoguard.dev';
    this.initTransport();
  }

  private initTransport(): void {
    const host = process.env['SMTP_HOST'];
    if (!host) {
      logger.warn('SMTP not configured — emails will be logged to console');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env['SMTP_PORT'] ?? '587', 10),
      secure: process.env['SMTP_PORT'] === '465',
      auth: {
        user: process.env['SMTP_USER'] ?? '',
        pass: process.env['SMTP_PASS'] ?? '',
      },
    });
  }

  async send(to: string[], subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      logger.info({ to, subject }, 'Alert Email (SMTP not configured):');
      logger.debug(html);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: to.join(', '),
        subject,
        html,
      });
      logger.info({ to, subject }, 'Alert email sent');
    } catch (err) {
      logger.error(err, 'Failed to send alert email');
      throw err;
    }
  }
}

export const emailChannel = new EmailChannel();
