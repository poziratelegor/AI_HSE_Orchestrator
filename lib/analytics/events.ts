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

export async function trackEvent(
  eventName: AnalyticsEventName,
  payload: TrackEventPayload = {}
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();

    const { error } = await supabase.from("analytics_events").insert({
      id: crypto.randomUUID(),
      event_name: eventName,
      user_id: payload.userId,
      session_id: payload.sessionId,
      workflow: payload.workflow,
      channel: payload.channel,
      duration_ms: payload.durationMs,
      error_code: payload.errorCode,
      meta: payload.meta ?? {}
    });

    if (error) {
      console.error("[analytics] trackEvent failed:", error);
    }
  } catch (err) {
    console.error("[analytics] trackEvent failed:", err);
  }
}

export type { TrackEventPayload };
