/** SDK type definitions */

/** Configuration for the ConvoGuard client */
export interface ConvoGuardConfig {
  /** Your ConvoGuard API key (starts with cg_live_) */
  apiKey: string;
  /** The project ID to send data to */
  projectId: string;
  /** 'realtime' returns analysis inline; 'batch' queues for async processing */
  mode?: 'realtime' | 'batch';
  /** Custom API endpoint (defaults to https://api.convoguard.dev) */
  endpoint?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
}

/** A conversation session */
export interface Conversation {
  id: string;
  projectId: string;
  externalId: string | null;
  status: 'active' | 'ended' | 'scoring';
  startedAt: string;
}

/** A single turn in a conversation */
export interface Turn {
  turnId: string;
  conversationId: string;
  speaker: 'user' | 'ai';
  status: 'recorded' | 'queued' | 'analyzed';
  timestamp: string;
  /** Analysis results (only in realtime mode for AI turns) */
  analysis?: TurnAnalysis;
}

/** Analysis results for an AI turn */
export interface TurnAnalysis {
  manipulationScore: number;
  answeredQuestion: boolean;
  patterns: PatternScores;
  flags: Flag[];
}

/** Probability scores for each manipulation pattern */
export interface PatternScores {
  topicHijacking: number;
  opinionInjection: number;
  falseUrgency: number;
  concernDismissal: number;
  agendaPersistence: number;
}

/** A detected manipulation flag */
export interface Flag {
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  excerpt: string;
  explanation: string;
}

/** Final conversation result after ending */
export interface ConversationResult {
  conversationId: string;
  tiltScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalTurns: number;
  flaggedTurns: number;
  summary: string;
  flags: Flag[];
  endedAt: string;
}

/** Options for starting a conversation */
export interface StartConversationOptions {
  externalId?: string;
  userMetadata?: Record<string, unknown>;
}

/** Options for adding a turn */
export interface AddTurnOptions {
  speaker: 'user' | 'ai';
  content: string;
  timestamp?: string;
}
