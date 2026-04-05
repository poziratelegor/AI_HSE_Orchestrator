import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg"
];

const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20);

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

  const { title, mimeType, sizeBytes } = body as Record<string, unknown>;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'title' обязательно.");
  }

  if (!mimeType || typeof mimeType !== "string") {
    return ERRORS.INVALID_INPUT("Поле 'mimeType' обязательно.");
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return ERRORS.INVALID_INPUT(
      `Неподдерживаемый тип файла. Допустимы: ${ALLOWED_MIME_TYPES.join(", ")}.`
    );
  }

  if (typeof sizeBytes === "number" && sizeBytes > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    return ERRORS.INVALID_INPUT(`Файл превышает лимит ${MAX_UPLOAD_SIZE_MB} МБ.`);
  }

  // 3. Вызов сервиса
  // TODO: создать запись documents(status: "pending") в Supabase,
  //       запустить chunking + embeddings через waitUntil() или очередь.
  // Инвариант: upload НЕ БЛОКИРУЕТ — fast response, processing async.
  return NextResponse.json({
    ok: true,
    documentId: null, // заменить на реальный id после записи в БД
    status: "pending",
    message: "Документ принят в обработку."
  });
}

