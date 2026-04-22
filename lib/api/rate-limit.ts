import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/cache/redis";

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Descriptive action name for logging */
  action: string;
  /** When true (default), Redis errors allow request. When false, deny on Redis failures. */
  failOpen?: boolean;
}

const DEFAULTS: RateLimitConfig = {
  limit: 30,
  windowSeconds: 60,
  action: "api_request",
  failOpen: true
};

/**
 * Checks whether `userId` has exceeded the rate limit for `action`.
 *
 * Uses Redis (Upstash) as the backing store with a sliding counter per window.
 * Key format: `rl:{userId}:{action}:{windowBucket}`
 * TTL = windowSeconds (counter auto-expires with the window).
 *
 * Graceful degradation: if Redis is unavailable the request is allowed (fail open).
 *
 * Returns `{ allowed: true }` when within limits.
 * Returns `{ allowed: false, response }` with a 429 NextResponse when exceeded.
 */
export async function checkRateLimit(
  userId: string,
  config: Partial<RateLimitConfig> = {}
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const { limit, windowSeconds, action, failOpen } = { ...DEFAULTS, ...config };

  try {
    // Fixed window bucket: floor(now / windowMs)
    const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rl:${userId}:${action}:${bucket}`;

    // Read current count
    const raw = await cacheGet(key);

    const current = raw !== null ? parseInt(raw, 10) : 0;

    if (current >= limit) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            ok: false,
            error: "rate_limit_exceeded",
            message: `Превышен лимит запросов: ${limit} в ${windowSeconds} секунд. Попробуйте позже.`,
            retryAfterSeconds: windowSeconds
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(windowSeconds),
              "X-RateLimit-Limit": String(limit),
              "X-RateLimit-Window": String(windowSeconds)
            }
          }
        )
      };
    }

    // Increment counter. TTL is set on first write (current === 0); subsequent
    // writes refresh are skipped to avoid extending the window unintentionally.
    // We always write to keep the count accurate.
    const newCount = current + 1;
    // Always write with TTL so the key expires at the end of the window
    await cacheSet(key, String(newCount), windowSeconds);

    return { allowed: true };
  } catch (err) {
    if (failOpen) {
      // Fail open — never block a legitimate request due to our own bug
      console.warn("[rate-limit] unexpected error, allowing request:", err);
      return { allowed: true };
    }
    console.warn("[rate-limit] unexpected error, denying request (fail-closed):", err);
    return {
      allowed: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "rate_limit_unavailable",
          message: "Сервис временно недоступен. Попробуйте позже.",
          retryAfterSeconds: windowSeconds
        },
        {
          status: 503,
          headers: {
            "Retry-After": String(windowSeconds),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Window": String(windowSeconds)
          }
        }
      )
    };
  }
}

/** Per-endpoint rate limit presets */
export const RATE_LIMITS = {
  orchestrate: { limit: 20, windowSeconds: 60, action: "orchestrate" },
  upload: { limit: 10, windowSeconds: 60, action: "upload" },
  ragQuery: { limit: 30, windowSeconds: 60, action: "rag_query" },
  integration: { limit: 5, windowSeconds: 60, action: "integration_sync" }
} satisfies Record<string, RateLimitConfig>;
