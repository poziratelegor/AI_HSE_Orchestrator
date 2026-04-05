import { NextResponse } from "next/server";
import { getSupabaseServerClient, getSupabaseUserFromRequest } from "@/lib/supabase/server";
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

async function markDocumentFailed(documentId: string, message: string) {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("documents")
    .update({
      // Some environments may have these extended columns; fallback below handles base schema.
      processing_status: "failed",
      status: "failed",
      error_message: message
    })
    .eq("id", documentId);

  if (!error) return;

  const { error: fallbackError } = await supabase
    .from("documents")
    .update({ processing_status: "failed" })
    .eq("id", documentId);

  if (fallbackError) {
    console.error("[documents] failed status update failed:", fallbackError);
  }
}

async function processDocumentInBackground(input: {
  documentId: string;
  userId: string;
  mimeType: string;
  title: string;
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
        mimeType: input.mimeType,
        title: input.title
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown document processing error";
    await markDocumentFailed(input.documentId, message);

    void trackEvent(ANALYTICS_EVENTS.DOCUMENT_FAILED, {
      userId: input.userId,
      workflow: "document_processing",
      channel: "web",
      errorCode: err instanceof Error ? err.name : "document_processing_failed",
      meta: {
        documentId: input.documentId,
        message
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

  // 3. Insert row in documents
  const supabase = getSupabaseServerClient();
  const documentId = crypto.randomUUID();
  const storagePath = `${user.id}/${documentId}`;
  const cleanTitle = title.trim();

  const insertPayload = {
    id: documentId,
    user_id: user.id,
    title: cleanTitle,
    file_path: storagePath,
    mime_type: mimeType,
    source_type: "upload",
    processing_status: "pending",
    status: "pending",
    file_size_bytes: typeof sizeBytes === "number" ? sizeBytes : undefined
  };

  let { error: insertError } = await supabase.from("documents").insert(insertPayload);

  if (insertError) {
    const fallbackPayload = {
      id: documentId,
      user_id: user.id,
      title: cleanTitle,
      file_path: storagePath,
      mime_type: mimeType,
      source_type: "upload",
      processing_status: "pending"
    };

    const fallbackResult = await supabase.from("documents").insert(fallbackPayload);
    insertError = fallbackResult.error;
  }

  if (insertError) {
    console.error("[documents] insert failed:", insertError);

    void trackEvent(ANALYTICS_EVENTS.DOCUMENT_FAILED, {
      userId: user.id,
      workflow: "document_upload",
      channel: "web",
      errorCode: "document_insert_failed",
      meta: {
        mimeType,
        title: cleanTitle,
        message: insertError.message
      }
    });

    return ERRORS.INTERNAL("Не удалось создать запись документа.");
  }

  void trackEvent(ANALYTICS_EVENTS.DOCUMENT_UPLOADED, {
    userId: user.id,
    workflow: "document_upload",
    channel: "web",
    meta: {
      documentId,
      title: cleanTitle,
      mimeType,
      sizeBytes: typeof sizeBytes === "number" ? sizeBytes : undefined
    }
  });

  void processDocumentInBackground({
    documentId,
    userId: user.id,
    mimeType,
    title: cleanTitle
  });

  return NextResponse.json({
    ok: true,
    documentId,
    status: "pending",
    message: "Документ принят в обработку."
  });
}
