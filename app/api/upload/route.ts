import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { trackEvent } from "@/lib/analytics/events";
import { ANALYTICS_EVENTS } from "@/lib/constants/analytics";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg"
];

const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20);

async function processDocumentInBackground(input: {
  documentId: string;
  userId: string;
  mimeType: string;
  sizeBytes?: number;
}) {
  try {
    // TODO: заменить на реальный pipeline chunking + embeddings.
    void input;

    void trackEvent(ANALYTICS_EVENTS.DOCUMENT_READY, {
      userId: input.userId,
      workflow: "document_processing",
      channel: "web",
      meta: {
        documentId: input.documentId,
        mimeType: input.mimeType
      }
    });
  } catch (err) {
    void trackEvent(ANALYTICS_EVENTS.DOCUMENT_FAILED, {
      userId: input.userId,
      workflow: "document_processing",
      channel: "web",
      errorCode: err instanceof Error ? err.name : "document_processing_failed",
      meta: {
        documentId: input.documentId,
        message: err instanceof Error ? err.message : "Unknown document processing error"
      }
    });
  }
}

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

  const documentId = crypto.randomUUID();

  void trackEvent(ANALYTICS_EVENTS.DOCUMENT_UPLOADED, {
    userId: user.id,
    workflow: "document_upload",
    channel: "web",
    meta: {
      documentId,
      title: title.trim(),
      mimeType,
      sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined
    }
  });

  void processDocumentInBackground({
    documentId,
    userId: user.id,
    mimeType,
    sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined
  });

  return NextResponse.json({
    ok: true,
    documentId,
    status: "pending",
    message: "Документ принят в обработку."
  });
}
