// Rate limiter for Anthropic API calls
// Respects Opus 4.5 Tier 1 limits: 50 req/min, 30K input tokens/min, 8K output tokens/min
// Uses sliding window (last 60 seconds) for accurate rate tracking

interface WindowEntry {
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

interface AcquireOptions {
  estimatedInputTokens: number;
  onQueued?: () => void;
  onProcessing?: () => void;
}

const LIMITS = {
  requestsPerMinute: 50,
  inputTokensPerMinute: 30000,
  outputTokensPerMinute: 8000,
  windowMs: 60000, // 60 seconds
} as const;

const MAX_BACKOFF_MS = 15000;
const INITIAL_BACKOFF_MS = 500;

export class RateLimiter {
  private entries: WindowEntry[] = [];

  private purgeOldEntries(): void {
    const cutoff = Date.now() - LIMITS.windowMs;
    this.entries = this.entries.filter((e) => e.timestamp > cutoff);
  }

  private getCurrentUsage(): {
    requests: number;
    inputTokens: number;
    outputTokens: number;
  } {
    this.purgeOldEntries();
    return {
      requests: this.entries.length,
      inputTokens: this.entries.reduce((sum, e) => sum + e.inputTokens, 0),
      outputTokens: this.entries.reduce((sum, e) => sum + e.outputTokens, 0),
    };
  }

  private hasCapacity(estimatedInputTokens: number): boolean {
    const usage = this.getCurrentUsage();
    return (
      usage.requests < LIMITS.requestsPerMinute &&
      usage.inputTokens + estimatedInputTokens <= LIMITS.inputTokensPerMinute
    );
  }

  async acquire(options: AcquireOptions): Promise<void> {
    const { estimatedInputTokens, onQueued, onProcessing } = options;

    if (this.hasCapacity(estimatedInputTokens)) {
      this.entries.push({
        timestamp: Date.now(),
        inputTokens: estimatedInputTokens,
        outputTokens: 0,
      });
      return;
    }

    // Capacity not immediately available — notify caller
    onQueued?.();

    let backoff = INITIAL_BACKOFF_MS;
    while (!this.hasCapacity(estimatedInputTokens)) {
      await new Promise((resolve) => setTimeout(resolve, backoff));
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
    }

    // Capacity available — record the request
    this.entries.push({
      timestamp: Date.now(),
      inputTokens: estimatedInputTokens,
      outputTokens: 0,
    });

    onProcessing?.();
  }

  report(actualInputTokens: number, actualOutputTokens: number): void {
    // Update the most recent entry with actual token counts
    // This improves accuracy of sliding window tracking
    const latest = this.entries[this.entries.length - 1];
    if (latest) {
      latest.inputTokens = actualInputTokens;
      latest.outputTokens = actualOutputTokens;
    }

    // Check if output tokens are approaching the limit and log a warning
    const usage = this.getCurrentUsage();
    if (usage.outputTokens > LIMITS.outputTokensPerMinute * 0.8) {
      console.warn(
        `[RateLimiter] Output token usage at ${usage.outputTokens}/${LIMITS.outputTokensPerMinute} per minute`
      );
    }
  }

  /** Get current usage stats (useful for debugging/monitoring) */
  getUsage(): {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    limits: typeof LIMITS;
  } {
    const usage = this.getCurrentUsage();
    return { ...usage, limits: LIMITS };
  }
}

// Singleton instance for the process
export const rateLimiter = new RateLimiter();
