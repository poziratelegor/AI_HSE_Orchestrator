/**
 * Wraps an async OpenAI call with exponential backoff retry.
 *
 * Retries on:
 *   - 429 Too Many Requests (rate limit)
 *   - 500 / 503 Server Error
 *   - Network timeouts / AbortError from upstream
 *
 * Does NOT retry on:
 *   - 400 Bad Request (invalid input — retrying won't help)
 *   - 401 Unauthorized (wrong key)
 */

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 16_000;

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    // OpenAI SDK wraps HTTP errors; check status property
    const status = (err as { status?: number }).status;
    if (status !== undefined) return RETRYABLE_STATUSES.has(status);
    // Network / timeout errors
    if (err.name === "AbortError" || err.message.includes("fetch")) return true;
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `fn` with up to `maxAttempts` attempts.
 * Uses jittered exponential backoff between retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;

      if (!isRetryable(err) || attempt === maxAttempts) {
        throw err;
      }

      const backoff = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
      const jitter = Math.random() * backoff * 0.3;
      const waitMs = Math.round(backoff + jitter);

      console.warn(
        `[ai/retry] attempt ${attempt}/${maxAttempts} failed, retrying in ${waitMs}ms`,
        (err as Error)?.message
      );

      await delay(waitMs);
    }
  }

  throw lastErr;
}
