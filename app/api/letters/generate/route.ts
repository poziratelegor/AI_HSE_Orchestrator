import { NextResponse } from "next/server";
import { runLetterGenerator } from "@/lib/services/letters";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

export async function POST(request: Request) {
  // 1. Optional auth
  const { user } = await getSupabaseUserFromRequest(request);

  // 2. Input validation
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

  // 3. Вызов сервиса
  const result = await runLetterGenerator(text.trim(), { userId: user?.id });
  return NextResponse.json(result);
}
