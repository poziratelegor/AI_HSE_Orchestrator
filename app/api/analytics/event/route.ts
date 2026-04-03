import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

const VALID_CHANNELS = ["web", "telegram"] as const;

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

  const { eventName, channel } = body as Record<string, unknown>;

  if (!eventName || typeof eventName !== "string" || eventName.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'eventName' обязательно.");
  }

  if (channel !== undefined && !VALID_CHANNELS.includes(channel as (typeof VALID_CHANNELS)[number])) {
    return ERRORS.INVALID_INPUT("Поле 'channel' должно быть 'web' или 'telegram'.");
  }

  // 3. Вызов сервиса
  // TODO: вызвать trackEvent() из lib/analytics/events.ts
  return NextResponse.json({
    ok: true,
    message: "Событие принято."
  });
}

