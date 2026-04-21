import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { runCheatSheet } from "@/lib/services/content/cheatsheet";

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
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно — передай тему или исходный материал.");
  }

  // 3. Вызов сервиса
  try {
    const result = await runCheatSheet(text as string);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/cheatsheet/generate] service error:", err);
    return ERRORS.INTERNAL("Не удалось создать шпаргалку.");
  }
}

