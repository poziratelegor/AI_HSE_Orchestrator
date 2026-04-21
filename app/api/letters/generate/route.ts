import { NextResponse } from "next/server";
import { runLetterGenerator } from "@/lib/services/communication/letters";
import { getSupabaseServerClient, getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { getProfile, isProfileComplete } from "@/lib/supabase/profile";

const MAX_INPUT_LENGTH = 10_000; // символов — письмо не должно быть «лекцией»

export async function POST(request: Request) {
  // 1. Auth обязателен — сгенерированные письма персонализируются по профилю
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 1.1 Profile gate: task/letter workflows доступны только с заполненным профилем
  const supabase = getSupabaseServerClient();
  const profile = await getProfile(user.id, supabase);
  if (!isProfileComplete(profile)) {
    return ERRORS.INVALID_INPUT(
      "Перед генерацией письма заполните профиль: ФИО, факультет и курс."
    );
  }

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
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно — опиши суть письма.");
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return ERRORS.INVALID_INPUT(`Слишком длинный текст (максимум ${MAX_INPUT_LENGTH} символов).`);
  }

  // 4. Вызов сервиса
  try {
    const result = await runLetterGenerator(text.trim(), { userId: user.id });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/letters/generate] service error:", err);
    return ERRORS.INTERNAL("Не удалось сгенерировать письмо.");
  }
}
