import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { runTaskExtractor } from "@/lib/services/planning/tasks";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";

const MAX_INPUT_LENGTH = 15_000;

export async function POST(request: Request) {
  // 1. Auth check
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Rate-limit
  const rl = await checkRateLimit(user.id, RATE_LIMITS.orchestrate);
  if (!rl.allowed) return rl.response;

  // 3. Input validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { text } = body as Record<string, unknown>;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно — передай текст с задачами или дедлайнами.");
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return ERRORS.INVALID_INPUT(`Слишком длинный текст (максимум ${MAX_INPUT_LENGTH} символов).`);
  }

  // 4. Вызов сервиса
  try {
    const result = await runTaskExtractor(text as string, { userId: user.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/tasks/extract] service error:", err);
    return ERRORS.INTERNAL("Не удалось извлечь задачи.");
  }
}

