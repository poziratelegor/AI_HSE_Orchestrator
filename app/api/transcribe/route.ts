import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseServerClient, getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { trackEvent } from "@/lib/analytics/events";
import { ANALYTICS_EVENTS } from "@/lib/constants/analytics";

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

  // 3. Получить аудиоблоб
  const startedAt = Date.now();
  let audioBlob: Blob;
  let filename = "audio.mp3";

  if (documentId) {
    // Скачать из Supabase Storage
    const supabase = getSupabaseServerClient();

    // Получаем storagePath из таблицы documents
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("file_path, mime_type, title")
      .eq("id", documentId)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc) {
      return ERRORS.INVALID_INPUT("Документ не найден или нет доступа.");
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download((doc as { file_path: string }).file_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { ok: false, error: "storage_error", message: "Не удалось скачать файл из хранилища." },
        { status: 500 }
      );
    }

    audioBlob = fileData;
    const docTyped = doc as { file_path: string; mime_type?: string; title?: string };
    filename = docTyped.title ?? docTyped.file_path.split("/").pop() ?? "audio.mp3";
  } else {
    // Скачать по внешнему URL
    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(audioUrl as string);
      if (!fetchResponse.ok) {
        return NextResponse.json(
          { ok: false, error: "fetch_error", message: `Не удалось скачать аудио: HTTP ${fetchResponse.status}` },
          { status: 422 }
        );
      }
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: "fetch_error", message: err instanceof Error ? err.message : "Сетевая ошибка." },
        { status: 422 }
      );
    }

    audioBlob = await fetchResponse.blob();
    const urlPath = new URL(audioUrl as string).pathname;
    filename = urlPath.split("/").pop() ?? "audio.mp3";
  }

  // 4. Whisper транскрипция
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const audioFile = new File([audioBlob], filename, { type: audioBlob.type || "audio/mpeg" });

    const transcription = await openai.audio.transcriptions.create(
      {
        file: audioFile,
        model: "whisper-1",
        language: "ru"
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    void trackEvent(ANALYTICS_EVENTS.TRANSCRIBE_SUCCESS, {
      userId: user.id,
      channel: "web",
      workflow: "transcribe_url_or_document",
      durationMs: Date.now() - startedAt,
      meta: {
        source: documentId ? "document" : "audio_url",
        hasDocumentId: Boolean(documentId)
      }
    });

    return NextResponse.json({
      ok: true,
      transcript: transcription.text,
      language: "ru"
    });
  } catch (err: unknown) {
    clearTimeout(timeout);

    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));

    void trackEvent(ANALYTICS_EVENTS.TRANSCRIBE_ERROR, {
      userId: user.id,
      channel: "web",
      workflow: "transcribe_url_or_document",
      durationMs: Date.now() - startedAt,
      errorCode: isAbort ? "timeout" : "whisper_error",
      meta: {
        source: documentId ? "document" : "audio_url",
        message: err instanceof Error ? err.message : "Unknown transcribe error"
      }
    });

    return NextResponse.json(
      {
        ok: false,
        error: isAbort ? "timeout" : "whisper_error",
        message: isAbort
          ? "Транскрипция превысила таймаут 60 секунд."
          : err instanceof Error
          ? err.message
          : "Неизвестная ошибка транскрипции."
      },
      { status: 500 }
    );
  }
}
