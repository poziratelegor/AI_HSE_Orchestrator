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

  const { text } = body as Record<string, unknown>;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно — опиши цель и сроки подготовки.");
  }

  // 3. Вызов сервиса
  // TODO: вызвать runStudyPlan() из lib/services/planner.ts
  return NextResponse.json({
    ok: true,
    workflow: "study_plan",
    plan: null,
    message: "Study plan builder не реализован."
  });
}

