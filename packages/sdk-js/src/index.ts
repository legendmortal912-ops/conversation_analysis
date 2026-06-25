/**
 * ConvoGuard JavaScript/TypeScript SDK
 *
 * Real-time AI manipulation detection for your chatbots,
 * sales bots, support bots, and AI agents.
 *
 * @example
 * ```typescript
 * import { ConvoGuard } from 'convoguard-js';
 *
 * const cg = new ConvoGuard({
 *   apiKey: 'cg_live_...',
 *   projectId: 'proj_...',
 * });
 *
 * const conv = await cg.startConversation();
 * await cg.addTurn(conv.id, { speaker: 'user', content: userMessage });
 * const result = await cg.addTurn(conv.id, { speaker: 'ai', content: aiResponse });
 * console.log(result.analysis?.flags); // Real-time manipulation flags
 *
 * const final = await cg.endConversation(conv.id);
 * console.log(`TiltScore: ${final.tiltScore}/100 (${final.grade})`);
 * ```
 */

import type {
  ConvoGuardConfig,
  Conversation,
  Turn,
  ConversationResult,
  StartConversationOptions,
  AddTurnOptions,
} from './types.js';
import { RetryHandler } from './retry.js';

const DEFAULT_ENDPOINT = 'https://api.convoguard.dev';

export class ConvoGuard {
  private readonly apiKey: string;
  private readonly projectId: string;
  private readonly mode: 'realtime' | 'batch';
  private readonly endpoint: string;
  private readonly retry: RetryHandler;

  constructor(config: ConvoGuardConfig) {
    if (!config.apiKey) {
      throw new Error('ConvoGuard: apiKey is required');
    }
    if (!config.projectId) {
      throw new Error('ConvoGuard: projectId is required');
    }

    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.mode = config.mode ?? 'realtime';
    this.endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, '');
    this.retry = new RetryHandler({
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000,
    });
  }

  /**
   * Start a new conversation.
   * Creates a conversation session on ConvoGuard and returns the conversation ID.
   */
  async startConversation(options?: StartConversationOptions): Promise<Conversation> {
    const response = await this.request('POST', '/v1/conversations', {
      project_id: this.projectId,
      external_id: options?.externalId,
      user_metadata: options?.userMetadata,
    });

    return {
      id: response.conversation_id as string,
      projectId: response.project_id as string,
      externalId: (response.external_id as string) ?? null,
      status: response.status as 'active',
      startedAt: response.started_at as string,
    };
  }

  /**
   * Add a turn (message) to a conversation.
   * AI turns are analyzed for manipulation patterns.
   * In 'realtime' mode, analysis results are returned inline.
   */
  async addTurn(conversationId: string, options: AddTurnOptions): Promise<Turn> {
    const response = await this.request(
      'POST',
      `/v1/conversations/${conversationId}/turns`,
      {
        speaker: options.speaker,
        content: options.content,
        timestamp: options.timestamp,
      },
    );

    const turn: Turn = {
      turnId: response.turn_id as string,
      conversationId,
      speaker: options.speaker,
      status: response.status as Turn['status'],
      timestamp: response.timestamp as string,
    };

    // Parse analysis results if present (realtime mode)
    if (response.analysis) {
      const analysis = response.analysis as Record<string, unknown>;
      turn.analysis = {
        manipulationScore: analysis.manipulation_score as number,
        answeredQuestion: analysis.answered_question as boolean,
        patterns: analysis.patterns as Turn['analysis'] extends undefined ? never : NonNullable<Turn['analysis']>['patterns'],
        flags: (analysis.flags as Turn['analysis'] extends undefined ? never : NonNullable<Turn['analysis']>['flags']) ?? [],
      };
    }

    return turn;
  }

  /**
   * End a conversation and trigger final scoring.
   * Returns the TiltScore, grade, and summary.
   */
  async endConversation(conversationId: string): Promise<ConversationResult> {
    const response = await this.request(
      'POST',
      `/v1/conversations/${conversationId}/end`,
      { ended_at: new Date().toISOString() },
    );

    return {
      conversationId: response.conversation_id as string,
      tiltScore: (response.tilt_score as number) ?? 0,
      grade: (response.grade as ConversationResult['grade']) ?? 'A',
      totalTurns: (response.total_turns as number) ?? 0,
      flaggedTurns: (response.flagged_turns as number) ?? 0,
      summary: (response.summary as string) ?? '',
      flags: (response.flags as ConversationResult['flags']) ?? [],
      endedAt: response.ended_at as string,
    };
  }

  /**
   * Send a batch of complete conversations for analysis.
   * Returns a batch ID that can be used to track processing.
   */
  async sendBatch(
    conversations: Array<{
      externalId?: string;
      turns: Array<{ speaker: 'user' | 'ai'; content: string; timestamp?: string }>;
    }>,
  ): Promise<{ batchId: string; queuedCount: number }> {
    const response = await this.request('POST', '/v1/batch', {
      conversations: conversations.map((c) => ({
        external_id: c.externalId,
        project_id: this.projectId,
        turns: c.turns,
      })),
    });

    return {
      batchId: response.batch_id as string,
      queuedCount: response.queued_count as number,
    };
  }

  /**
   * Express/Fastify middleware helper.
   * Intercepts request/response to capture AI conversation turns automatically.
   *
   * @example
   * ```typescript
   * app.use('/chat', cg.middleware());
   * ```
   */
  middleware(): (req: unknown, res: unknown, next: () => void) => void {
    const self = this;
    return (_req: unknown, _res: unknown, next: () => void) => {
      // Middleware implementation would wrap the request/response
      // to capture conversation turns automatically.
      // This is a foundation — specific integration depends on
      // the AI framework being used (e.g., LangChain, custom).
      next();
    };
  }

  /**
   * Create a streaming interface for a conversation.
   * Useful for streaming responses where turns are built incrementally.
   */
  createStream(conversationId: string): ConvoGuardStream {
    return new ConvoGuardStream(this, conversationId);
  }

  /** Internal HTTP request method */
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = `${this.endpoint}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        'User-Agent': 'convoguard-js/1.0.0',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await this.retry.fetchWithRetry(url, options);

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as Record<string, unknown>;
      const error = new Error(
        (errorBody.message as string) ??
        `ConvoGuard API error: ${response.status} ${response.statusText}`,
      );
      (error as Error & { status: number; body: unknown }).status = response.status;
      (error as Error & { body: unknown }).body = errorBody;
      throw error;
    }

    return response.json() as Promise<Record<string, unknown>>;
  }

  /** Destroy the client and flush any pending requests */
  destroy(): void {
    this.retry.destroy();
  }
}

/**
 * Streaming interface for building turns incrementally.
 * Buffers content and sends the complete turn when flushed.
 */
export class ConvoGuardStream {
  private client: ConvoGuard;
  private conversationId: string;
  private buffer = '';
  private currentSpeaker: 'user' | 'ai' = 'ai';

  constructor(client: ConvoGuard, conversationId: string) {
    this.client = client;
    this.conversationId = conversationId;
  }

  /** Write content to the buffer */
  write(speaker: 'user' | 'ai', content: string): void {
    if (speaker !== this.currentSpeaker && this.buffer) {
      // Speaker changed — flush the current buffer
      this.flush().catch(console.error);
    }
    this.currentSpeaker = speaker;
    this.buffer += content;
  }

  /** Flush the buffered content as a complete turn */
  async flush(): Promise<Turn | null> {
    if (!this.buffer) return null;

    const content = this.buffer;
    const speaker = this.currentSpeaker;
    this.buffer = '';

    return this.client.addTurn(this.conversationId, { speaker, content });
  }

  /** End the stream and flush any remaining content */
  async end(): Promise<ConversationResult> {
    await this.flush();
    return this.client.endConversation(this.conversationId);
  }
}
