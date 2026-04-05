import { NextResponse } from "next/server";
import { ERRORS } from "@/lib/api/helpers";
import { orchestrate } from "@/lib/orchestrator/router";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics/events";
import { ANALYTICS_EVENTS, type AnalyticsChannel } from "@/lib/constants/analytics";

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

  const { text, channel, attachments } = body as Record<string, unknown>;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно и должно быть непустой строкой.");
  }

  if (channel !== undefined && channel !== "web" && channel !== "telegram") {
    return ERRORS.INVALID_INPUT("Поле 'channel' должно быть 'web' или 'telegram'.");
  }

  const requestChannel = ((channel as AnalyticsChannel | undefined) ?? "web") as AnalyticsChannel;
  const startedAt = Date.now();

  // 3. Вызов сервиса
  try {
    const result = await orchestrate({
      text: text.trim(),
      channel: requestChannel,
      attachments: Array.isArray(attachments) ? attachments : [],
      userId: user.id
    });

    const durationMs = Date.now() - startedAt;
    const workflow =
      typeof (result as { workflow?: unknown }).workflow === "string"
        ? ((result as { workflow: string }).workflow ?? undefined)
        : typeof (result as { result?: { workflow?: unknown } }).result?.workflow === "string"
        ? ((result as { result: { workflow: string } }).result.workflow ?? undefined)
        : undefined;

    const isFallback = workflow === "route_recommender";

    void trackEvent(
      isFallback ? ANALYTICS_EVENTS.ORCHESTRATE_FALLBACK : ANALYTICS_EVENTS.ORCHESTRATE_SUCCESS,
      {
        userId: user.id,
        workflow,
        channel: requestChannel,
        durationMs,
        meta: {
          hasAttachments: Array.isArray(attachments) && attachments.length > 0,
          ok: Boolean((result as { ok?: unknown }).ok)
        }
      }
    );

    return NextResponse.json(result);
  } catch (err) {
    void trackEvent(ANALYTICS_EVENTS.ORCHESTRATE_ERROR, {
      userId: user.id,
      workflow: "route_recommender",
      channel: requestChannel,
      durationMs: Date.now() - startedAt,
      errorCode: err instanceof Error ? err.name : "orchestrate_error",
      meta: {
        message: err instanceof Error ? err.message : "Unknown orchestrate error"
      }
    });

    return ERRORS.INTERNAL("Ошибка оркестратора. Попробуй ещё раз.");
  }
}
