import { NextResponse } from "next/server";
import { processDocument } from "@/lib/services/ingestion";
import { getSupabaseServerClient, getSupabaseUserFromRequest } from "@/lib/supabase/server";
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

async function markDocumentFailed(documentId: string, message: string) {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("documents")
    .update({
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

export async function POST(request: Request) {
  // 1. Auth check
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Parse multipart/form-data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть multipart/form-data.");
  }

  const fileValue = formData.get("file");
  const titleValue = formData.get("title");
  const mimeTypeValue = formData.get("mimeType");

  if (!(fileValue instanceof File)) {
    return ERRORS.INVALID_INPUT("Поле 'file' обязательно.");
  }

  if (typeof titleValue !== "string" || titleValue.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'title' обязательно.");
  }

  const title = titleValue.trim();
  const mimeType = typeof mimeTypeValue === "string" && mimeTypeValue.trim().length > 0
    ? mimeTypeValue
    : fileValue.type;

  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return ERRORS.INVALID_INPUT(
      `Неподдерживаемый тип файла. Допустимы: ${ALLOWED_MIME_TYPES.join(", ")}.`
    );
  }

  const sizeBytes = fileValue.size;
  if (sizeBytes > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    return ERRORS.INVALID_INPUT(`Файл превышает лимит ${MAX_UPLOAD_SIZE_MB} МБ.`);
  }

  // 3. Insert row in documents
  const supabase = getSupabaseServerClient();
  const documentId = crypto.randomUUID();
  const storagePath = `${user.id}/${documentId}`;
  const insertPayload = {
    id: documentId,
    user_id: user.id,
    title,
    file_path: storagePath,
    mime_type: mimeType,
    source_type: "upload",
    processing_status: "pending",
    status: "pending",
    file_size_bytes: sizeBytes
  };

  let { error: insertError } = await supabase.from("documents").insert(insertPayload);

  if (insertError) {
    const fallbackPayload = {
      id: documentId,
      user_id: user.id,
      title,
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
    return ERRORS.INTERNAL("Не удалось создать запись документа.");
  }

  // 4. Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileValue, { contentType: mimeType, upsert: false });

  if (uploadError) {
    console.error("[documents] storage upload failed:", uploadError);
    await markDocumentFailed(documentId, uploadError.message);

    return ERRORS.INTERNAL("Не удалось загрузить файл в хранилище.");
  }

  // 5. Fire-and-forget processing
  void processDocument({
    documentId,
    storagePath,
    mimeType
  });

  return NextResponse.json({
    ok: true,
    documentId,
    status: "pending",
    message: "Документ принят в обработку."
  });
}
