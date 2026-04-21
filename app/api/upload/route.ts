import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { processDocument } from "@/lib/services/documents/ingestion";
import { getSupabaseServerClient, getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm",
  "audio/x-m4a", "audio/flac",
]);

const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20);

async function markDocumentFailed(documentId: string, message: string) {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("documents")
    .update({
      processing_status: "failed",
      error_message: message
    })
    .eq("id", documentId);

  if (error) {
    console.error("[documents] failed status update failed:", error);
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

  const declaredType = mimeType;
  if (!declaredType || !ALLOWED_MIME_TYPES.has(declaredType)) {
    return ERRORS.INVALID_INPUT("Поддерживаются: PDF, TXT, аудиофайлы");
  }

  // Magic bytes validation — guard against MIME spoofing
  const headerBytes = await fileValue.slice(0, 4).arrayBuffer();
  const magic = new Uint8Array(headerBytes);
  const isPdf = magic[0] === 0x25 && magic[1] === 0x50; // %P
  const isOgg = magic[0] === 0x4F && magic[1] === 0x67; // Og
  const isMp3 = magic[0] === 0xFF && (magic[1] & 0xE0) === 0xE0;
  const isId3 = magic[0] === 0x49 && magic[1] === 0x44 && magic[2] === 0x33; // ID3

  if (declaredType === "application/pdf" && !isPdf) {
    return NextResponse.json({ ok: false, error: "invalid_file_type", message: "Поддерживаются: PDF, TXT, аудиофайлы" }, { status: 400 });
  }
  if ((declaredType === "audio/mpeg") && !isMp3 && !isId3) {
    return NextResponse.json({ ok: false, error: "invalid_file_type", message: "Поддерживаются: PDF, TXT, аудиофайлы" }, { status: 400 });
  }
  if (declaredType === "audio/ogg" && !isOgg) {
    return NextResponse.json({ ok: false, error: "invalid_file_type", message: "Поддерживаются: PDF, TXT, аудиофайлы" }, { status: 400 });
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
    file_size_bytes: sizeBytes
  };

  const { error: insertError } = await supabase.from("documents").insert(insertPayload);

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

  // 5. Background processing — keep alive until done on Vercel
  waitUntil(processDocument({ documentId, storagePath, mimeType }));

  return NextResponse.json({
    ok: true,
    documentId,
    status: "pending",
    message: "Документ принят в обработку."
  });
}
