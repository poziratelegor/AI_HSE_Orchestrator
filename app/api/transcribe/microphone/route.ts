import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

export async function POST(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return ERRORS.INVALID_INPUT("Ожидается multipart/form-data.");
  }

  const audioBlob = formData.get("audio");
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    return ERRORS.INVALID_INPUT("Поле 'audio' обязательно (Blob).");
  }
  if (audioBlob.size === 0) {
    return ERRORS.INVALID_INPUT("Аудио пустое. Запишите сообщение ещё раз.");
  }

  if (audioBlob.size > 25 * 1024 * 1024) {
    return ERRORS.INVALID_INPUT("Файл превышает лимит 25 МБ.");
  }

  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const file = new File([audioBlob], "recording.webm", {
      type: audioBlob.type || "audio/webm",
    });

    const result = await openai.audio.transcriptions.create(
      { file, model: "whisper-1", language: "ru" },
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    return NextResponse.json({ ok: true, transcript: result.text });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        error: isAbort ? "timeout" : "whisper_error",
        message: isAbort
          ? "Превышен таймаут 60 секунд."
          : err instanceof Error
            ? err.message
            : "Ошибка транскрипции.",
      },
      { status: 500 }
    );
  }
}
