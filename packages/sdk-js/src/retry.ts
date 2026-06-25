/**
 * Retry utility with exponential backoff and offline queue.
 * Handles transient network failures gracefully.
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  timeout: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 500,
  maxDelay: 10000,
  timeout: 30000,
};

/** Queue for requests that failed due to network issues */
interface QueuedRequest {
  url: string;
  options: RequestInit;
  resolve: (value: Response) => void;
  reject: (reason: unknown) => void;
  retryCount: number;
}

export class RetryHandler {
  private config: RetryConfig;
  private queue: QueuedRequest[] = [];
  private isOnline = true;
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };

    // Browser environment: listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.onOnline());
      window.addEventListener('offline', () => this.onOffline());
    }
  }

  private onOnline(): void {
    this.isOnline = true;
    this.flushQueue();
  }

  private onOffline(): void {
    this.isOnline = false;
  }

  /** Execute a fetch request with retry logic */
  async fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Don't retry 4xx errors (client errors) except 429 (rate limited)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return response;
        }

        // Retry on 5xx or 429
        if (response.ok) {
          return response;
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // If offline, queue the request
        if (!this.isOnline) {
          return this.enqueue(url, options);
        }
      }

      // Wait before retry (exponential backoff with jitter)
      if (attempt < this.config.maxRetries) {
        const delay = Math.min(
          this.config.baseDelay * Math.pow(2, attempt) + Math.random() * 200,
          this.config.maxDelay,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }

  /** Enqueue a request for later when connection is restored */
  private enqueue(url: string, options: RequestInit): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      this.queue.push({ url, options, resolve, reject, retryCount: 0 });

      // Start periodic flush attempts
      if (!this.flushInterval) {
        this.flushInterval = setInterval(() => this.flushQueue(), 5000);
      }
    });
  }

  /** Attempt to flush queued requests */
  private async flushQueue(): Promise<void> {
    if (!this.isOnline || this.queue.length === 0) return;

    const pending = [...this.queue];
    this.queue = [];

    for (const item of pending) {
      try {
        const response = await this.fetchWithRetry(item.url, item.options);
        item.resolve(response);
      } catch (err) {
        if (item.retryCount < this.config.maxRetries) {
          item.retryCount++;
          this.queue.push(item);
        } else {
          item.reject(err);
        }
      }
    }

    if (this.queue.length === 0 && this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /** Get the number of queued requests */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** Destroy the retry handler and reject all queued requests */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    for (const item of this.queue) {
      item.reject(new Error('RetryHandler destroyed'));
    }
    this.queue = [];
  }
}
