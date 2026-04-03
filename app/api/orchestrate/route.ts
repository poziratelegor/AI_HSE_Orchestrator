import { NextResponse } from "next/server";
import { orchestrate } from "@/lib/orchestrator/router";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

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

  // 3. Вызов сервиса
  try {
    const result = await orchestrate({
      text: text.trim(),
      channel: (channel as "web" | "telegram") ?? "web",
      attachments: Array.isArray(attachments) ? attachments : []
    });

    return NextResponse.json(result);
  } catch {
    return ERRORS.INTERNAL("Ошибка оркестратора. Попробуй ещё раз.");
  }
}

