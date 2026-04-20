import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { trackEvent } from "@/lib/analytics/events";
import {
  ANALYTICS_CHANNELS,
  ANALYTICS_EVENTS,
  type AnalyticsChannel,
  type AnalyticsEventName
} from "@/lib/constants/analytics";

const VALID_EVENT_NAMES = new Set<AnalyticsEventName>(Object.values(ANALYTICS_EVENTS));

export async function POST(request: Request) {
  // 1. Auth check
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Input validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { eventName, channel, workflow, sessionId, durationMs, errorCode, meta } =
    body as Record<string, unknown>;

  if (!eventName || typeof eventName !== "string") {
    return ERRORS.INVALID_INPUT("Поле 'eventName' обязательно.");
  }

  if (!VALID_EVENT_NAMES.has(eventName as AnalyticsEventName)) {
    return ERRORS.INVALID_INPUT("Неизвестное имя события аналитики.");
  }

  if (
    channel !== undefined &&
    !ANALYTICS_CHANNELS.includes(channel as (typeof ANALYTICS_CHANNELS)[number])
  ) {
    return ERRORS.INVALID_INPUT("Поле 'channel' должно быть 'web' или 'telegram'.");
  }

  void trackEvent(eventName as AnalyticsEventName, {
    userId: user.id,
    channel: channel as AnalyticsChannel | undefined,
    workflow: typeof workflow === "string" ? workflow : undefined,
    sessionId: typeof sessionId === "string" ? sessionId : undefined,
    durationMs: typeof durationMs === "number" ? durationMs : undefined,
    errorCode: typeof errorCode === "string" ? errorCode : undefined,
    meta: meta && typeof meta === "object" ? (meta as Record<string, unknown>) : undefined
  });

  return NextResponse.json({
    ok: true,
    message: "Событие принято."
  });
}
