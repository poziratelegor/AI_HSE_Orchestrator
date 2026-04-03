import { NextResponse } from "next/server";
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

  const { message, conversationId } = body as Record<string, unknown>;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'message' обязательно и должно быть непустой строкой.");
  }

  if (conversationId !== undefined && typeof conversationId !== "string") {
    return ERRORS.INVALID_INPUT("Поле 'conversationId' должно быть строкой.");
  }

  // 3. Вызов сервиса
  // TODO: сохранить сообщение в conversations/messages, вызвать оркестратор или LLM напрямую
  return NextResponse.json({
    ok: true,
    reply: null,
    conversationId: conversationId ?? null,
    message: "Chat не реализован."
  });
}

