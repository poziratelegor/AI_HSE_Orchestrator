import { getSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
  /** Descriptive action name for logging */
  action: string;
}

const DEFAULTS: RateLimitConfig = {
  limit: 30,
  windowSeconds: 60,
  action: "api_request"
};

/**
 * Checks whether `userId` has exceeded the rate limit for `action`.
 * Uses `analytics_events` table — counts events within the rolling window.
 *
 * Returns `{ allowed: true }` when within limits.
 * Returns `{ allowed: false, response }` with a 429 NextResponse when exceeded.
 */
export async function checkRateLimit(
  userId: string,
  config: Partial<RateLimitConfig> = {}
): Promise<{ allowed: true } | { allowed: false; response: NextResponse }> {
  const { limit, windowSeconds, action } = { ...DEFAULTS, ...config };

  try {
    const supabase = getSupabaseServerClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { count, error } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_name", `rate_limit_check:${action}`)
      .gte("created_at", windowStart);

    if (error) {
      // If we can't check the rate limit, allow the request (fail open)
      console.warn("[rate-limit] check failed, allowing request:", error.message);
      return { allowed: true };
    }

    if ((count ?? 0) >= limit) {
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

    // Record this request
    void supabase.from("analytics_events").insert({
      id: crypto.randomUUID(),
      user_id: userId,
      event_name: `rate_limit_check:${action}`,
      created_at: new Date().toISOString()
    });

    return { allowed: true };
  } catch (err) {
    // Fail open — never block a legitimate request due to our own bug
    console.warn("[rate-limit] unexpected error, allowing request:", err);
    return { allowed: true };
  }
}

/** Per-endpoint rate limit presets */
export const RATE_LIMITS = {
  orchestrate: { limit: 20, windowSeconds: 60, action: "orchestrate" },
  upload: { limit: 10, windowSeconds: 60, action: "upload" },
  ragQuery: { limit: 30, windowSeconds: 60, action: "rag_query" },
  integration: { limit: 5, windowSeconds: 60, action: "integration_sync" }
} satisfies Record<string, RateLimitConfig>;
