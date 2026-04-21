import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AnalyticsChannel, AnalyticsEventName } from "@/lib/constants/analytics";

type TrackEventPayload = {
  userId?: string;
  sessionId?: string;
  workflow?: string;
  channel?: AnalyticsChannel;
  durationMs?: number;
  errorCode?: string;
  meta?: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown, fallback = "analytics_insert_error"): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (error instanceof Error && error.name) {
    return error.name;
  }

  return fallback;
}

function isTransientAnalyticsError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "";

  if (/^(08|53|57P01)/.test(code)) {
    return true;
  }

  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : typeof error === "string"
      ? error.toLowerCase()
      : "";

  return /(network|fetch|timeout|temporar|econnreset|enotfound|eai_again|connection)/.test(message);
}

export async function trackEvent(
  eventName: AnalyticsEventName,
  payload: TrackEventPayload = {}
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const channel = payload.channel ?? "web";
  const workflow = payload.workflow ?? "unknown_workflow";
  let lastErrorCode = payload.errorCode ?? "analytics_insert_error";
  let lastAttempt = 1;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    lastAttempt = attempt;
    try {
      const { error } = await supabase.from("analytics_events").insert({
        id: crypto.randomUUID(),
        event_name: eventName,
        user_id: payload.userId,
        session_id: payload.sessionId,
        workflow,
        channel,
        duration_ms: payload.durationMs,
        error_code: payload.errorCode,
        meta: payload.meta ?? {}
      });

      if (!error) {
        return;
      }

      lastErrorCode = getErrorCode(error, payload.errorCode ?? "analytics_insert_error");
      const transient = isTransientAnalyticsError(error);

      console.warn("[analytics][delivery_warn]", {
        marker: "ANALYTICS_DELIVERY_WARN",
        eventName,
        userId: payload.userId ?? null,
        workflow,
        attempt,
        errorCode: lastErrorCode
      });

      if (!transient || attempt >= MAX_ATTEMPTS) {
        break;
      }

      await sleep(RETRY_BASE_DELAY_MS * attempt);
    } catch (error) {
      lastErrorCode = getErrorCode(error, payload.errorCode ?? "analytics_runtime_error");
      const transient = isTransientAnalyticsError(error);

      console.warn("[analytics][delivery_warn]", {
        marker: "ANALYTICS_DELIVERY_WARN",
        eventName,
        userId: payload.userId ?? null,
        workflow,
        attempt,
        errorCode: lastErrorCode
      });

      if (!transient || attempt >= MAX_ATTEMPTS) {
        break;
      }

      await sleep(RETRY_BASE_DELAY_MS * attempt);
    }
  }

  console.error("[analytics][delivery_error]", {
    marker: "ANALYTICS_DELIVERY_ERROR",
    eventName,
    userId: payload.userId ?? null,
    workflow,
    attempt: lastAttempt,
    errorCode: lastErrorCode
  });
}

export type { TrackEventPayload };
