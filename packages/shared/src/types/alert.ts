/**
 * @module alert
 * Alert, AlertConfig, and AlertChannel types for real-time notifications.
 */

import type { FlagSeverity } from './conversation.js';

/** Supported notification channels. */
export type AlertChannel = 'WEBHOOK' | 'SLACK' | 'EMAIL';

/** Delivery status of a single alert. */
export type AlertStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING' | 'SKIPPED_DEDUP' | 'SKIPPED_RATELIMIT';

/**
 * Per-project configuration that defines how and when alerts are delivered.
 */
export interface AlertConfig {
  /** Unique identifier (nanoid). */
  id: string;
  /** Project this config applies to. */
  projectId: string;
  /** Notification channel. */
  channel: AlertChannel;
  /** Webhook URL for generic HTTP POST alerts. */
  webhookUrl: string | null;
  /** Slack incoming-webhook URL. */
  slackWebhookUrl: string | null;
  /** Email addresses for email-channel alerts. */
  emailAddresses: string[];
  /** Whether this alert config is active. */
  enabled: boolean;
  /** Minimum severity level that triggers this alert. */
  minSeverity: FlagSeverity;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-update timestamp. */
  updatedAt: string;
}

/**
 * An alert instance — one alert is created for each config×trigger combination.
 */
export interface Alert {
  /** Unique identifier (nanoid). */
  id: string;
  /** The AlertConfig that generated this alert. */
  alertConfigId: string;
  /** Conversation that triggered the alert. */
  conversationId: string;
  /** Flag that triggered the alert (if applicable). */
  flagId: string | null;
  /** Channel used for delivery. */
  channel: AlertChannel;
  /** Current delivery status. */
  status: AlertStatus;
  /** TiltScore at the time the alert was triggered. */
  tiltScore: number;
  /** Human-readable summary sent in the alert body. */
  message: string;
  /** Number of delivery attempts so far. */
  attemptCount: number;
  /** ISO-8601 timestamp of the last delivery attempt. */
  lastAttemptAt: string | null;
  /** ISO-8601 timestamp when delivery succeeded. */
  sentAt: string | null;
  /** Error message from the last failed attempt. */
  lastError: string | null;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}
