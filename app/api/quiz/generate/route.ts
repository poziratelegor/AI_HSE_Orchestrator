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

  const { text, questionCount } = body as Record<string, unknown>;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно — передай тему или исходный материал.");
  }

  if (questionCount !== undefined) {
    const count = Number(questionCount);
    if (!Number.isInteger(count) || count < 1 || count > 50) {
      return ERRORS.INVALID_INPUT("Поле 'questionCount' должно быть целым числом от 1 до 50.");
    }
  }

  // 3. Вызов сервиса
  // TODO: вызвать runQuizGenerator() из lib/services/quiz.ts
  return NextResponse.json({
    ok: true,
    workflow: "quiz_generator",
    questions: [],
    message: "Quiz generator не реализован."
  });
}

