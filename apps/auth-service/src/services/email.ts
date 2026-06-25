import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../utils/logger.js';

/** Email template types */
type TemplateName = 'invite' | 'password-reset' | 'alert' | 'welcome';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Email service using Nodemailer with configurable SMTP transport.
 * Provides HTML email templates for invites, password resets, and alerts.
 */
class EmailService {
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

  /** Send an email. Falls back to console logging if SMTP is not configured. */
  async send(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      logger.info({ to: options.to, subject: options.subject }, 'Email (SMTP not configured):');
      logger.debug(options.html);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      logger.info({ to: options.to, subject: options.subject }, 'Email sent');
    } catch (err) {
      logger.error(err, 'Failed to send email');
      throw err;
    }
  }

  /** Send an invite email with a magic link */
  async sendInvite(to: string, orgName: string, inviteToken: string): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
    const link = `${frontendUrl}/accept-invite/${inviteToken}`;

    await this.send({
      to,
      subject: `You've been invited to join ${orgName} on ConvoGuard`,
      html: this.renderTemplate('invite', { orgName, link }),
    });
  }

  /** Send a password reset email */
  async sendPasswordReset(to: string, resetToken: string): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
    const link = `${frontendUrl}/reset-password/${resetToken}`;

    await this.send({
      to,
      subject: 'Reset your ConvoGuard password',
      html: this.renderTemplate('password-reset', { link }),
    });
  }

  /** Send a welcome email after registration */
  async sendWelcome(to: string, name: string): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';
    await this.send({
      to,
      subject: 'Welcome to ConvoGuard',
      html: this.renderTemplate('welcome', { name, dashboardUrl: frontendUrl }),
    });
  }

  /** Render an HTML email template */
  private renderTemplate(template: TemplateName, data: Record<string, string>): string {
    const baseStyle = `
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 560px; margin: 0 auto; padding: 40px 20px;
      background: #ffffff; color: #1e293b;
    `;
    const buttonStyle = `
      display: inline-block; padding: 12px 32px; background: #6366f1;
      color: #ffffff; text-decoration: none; border-radius: 8px;
      font-weight: 600; font-size: 14px;
    `;
    const footerStyle = `
      margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0;
      color: #94a3b8; font-size: 12px;
    `;

    const templates: Record<TemplateName, string> = {
      invite: `
        <div style="${baseStyle}">
          <h1 style="color: #0f172a; font-size: 24px;">You're invited! 🎉</h1>
          <p>You've been invited to join <strong>${data['orgName']}</strong> on ConvoGuard — the real-time AI manipulation detection platform.</p>
          <p>Click the button below to set up your account and get started:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${data['link']}" style="${buttonStyle}">Accept Invitation</a>
          </p>
          <p style="color: #64748b; font-size: 13px;">This invite link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
          <div style="${footerStyle}">ConvoGuard — See what your AI is really doing to your users.</div>
        </div>`,

      'password-reset': `
        <div style="${baseStyle}">
          <h1 style="color: #0f172a; font-size: 24px;">Reset Your Password</h1>
          <p>We received a request to reset your ConvoGuard password. Click the button below to choose a new password:</p>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${data['link']}" style="${buttonStyle}">Reset Password</a>
          </p>
          <p style="color: #64748b; font-size: 13px;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
          <div style="${footerStyle}">ConvoGuard — See what your AI is really doing to your users.</div>
        </div>`,

      welcome: `
        <div style="${baseStyle}">
          <h1 style="color: #0f172a; font-size: 24px;">Welcome to ConvoGuard, ${data['name']}! 🚀</h1>
          <p>Your account is ready. You can now start monitoring your AI conversations for manipulation patterns.</p>
          <h3 style="color: #0f172a;">Quick Start:</h3>
          <ol style="color: #475569; line-height: 1.8;">
            <li>Create your first project</li>
            <li>Generate an API key</li>
            <li>Integrate our SDK (JavaScript or Python)</li>
            <li>Send your first conversation</li>
          </ol>
          <p style="text-align: center; margin: 32px 0;">
            <a href="${data['dashboardUrl']}" style="${buttonStyle}">Go to Dashboard</a>
          </p>
          <div style="${footerStyle}">ConvoGuard — See what your AI is really doing to your users.</div>
        </div>`,

      alert: `
        <div style="${baseStyle}">
          <h1 style="color: #ef4444; font-size: 24px;">⚠️ Alert Triggered</h1>
          <p>A manipulation alert has been triggered in your project.</p>
          <div style="${footerStyle}">ConvoGuard — See what your AI is really doing to your users.</div>
        </div>`,
    };

    return templates[template] ?? '<p>Unknown template</p>';
  }
}

/** Singleton email service instance */
export const emailService = new EmailService();
