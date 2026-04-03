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

  const { audioUrl, documentId } = body as Record<string, unknown>;

  if (!audioUrl && !documentId) {
    return ERRORS.INVALID_INPUT("Необходимо передать 'audioUrl' или 'documentId'.");
  }

  if (audioUrl !== undefined && typeof audioUrl !== "string") {
    return ERRORS.INVALID_INPUT("Поле 'audioUrl' должно быть строкой.");
  }

  if (documentId !== undefined && typeof documentId !== "string") {
    return ERRORS.INVALID_INPUT("Поле 'documentId' должно быть строкой.");
  }

  // 3. Вызов сервиса
  // TODO: вызвать OpenAI Whisper через lib/openai/client.ts
  return NextResponse.json({
    ok: true,
    workflow: "transcribe",
    transcript: null,
    message: "Транскрипция не реализована."
  });
}

