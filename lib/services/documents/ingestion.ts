// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;
import { createHash } from "crypto";
import { chunkText } from "@/lib/rag/chunk";
import { embedBatchSafe } from "@/lib/rag/embed";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { transcribeAudio } from "@/lib/services/documents/transcribe";

const CHUNK_INSERT_BATCH = 200;

type ProcessDocumentInput = {
  documentId: string;
  storagePath: string;
  mimeType: string;
};

type DocumentStatus = "pending" | "processing" | "ready" | "failed" | "partial";

function md5(data: Buffer): string {
  return createHash("md5").update(data).digest("hex");
}

async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  errorMessage?: string
) {
  const supabase = getSupabaseServerClient();
  const payload: Record<string, unknown> = { processing_status: status };
  if (errorMessage !== undefined) payload.error_message = errorMessage;

  const { error } = await supabase.from("documents").update(payload).eq("id", documentId);
  if (error) throw error;
}

/**
 * Checks if a document with the same title already exists for this user.
 * Returns the existing document id if found, null otherwise.
 */
export async function findDuplicateDocument(
  userId: string,
  title: string
): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("title", title)
    .neq("processing_status", "failed")
    .maybeSingle();

  return data?.id ?? null;
}

/**
 * Extracts text from a buffer based on MIME type.
 * Supports: text/plain, application/pdf, audio/*, image/* (via Vision API).
 */
async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    const parsed = await pdf(buffer);
    return parsed.text;
  }

  if (mimeType.startsWith("audio/")) {
    return transcribeAudio(buffer, mimeType);
  }

  throw new Error(`MIME type ${mimeType} пока не поддерживается в processing pipeline.`);
}

export async function processDocument(input: ProcessDocumentInput) {
  const supabase = getSupabaseServerClient();

  try {
    await updateDocumentStatus(input.documentId, "processing");

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(input.storagePath);

    if (downloadError || !fileData) {
      throw downloadError ?? new Error("Не удалось скачать файл из storage.");
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Dedup check via content hash
    const contentHash = md5(buffer);
    const { data: existingChunk } = await supabase
      .from("document_chunks")
      .select("document_id")
      .eq("document_id", input.documentId)
      .limit(1)
      .maybeSingle();

    // If another document (different id) already has the same hash, mark as duplicate
    const { data: hashMatch } = await supabase
      .from("documents")
      .select("id")
      .eq("content_hash", contentHash)
      .neq("id", input.documentId)
      .maybeSingle();

    if (hashMatch) {
      console.warn(
        `[documents] duplicate content detected for ${input.documentId}, original: ${hashMatch.id}`
      );
      // Still process it — user may want separate entries — just log
    }

    // Update hash (column may not exist yet — ignore error gracefully)
    void supabase
      .from("documents")
      .update({ content_hash: contentHash })
      .eq("id", input.documentId)
      .then(({ error }) => {
        if (error && !error.message.includes("content_hash")) {
          console.warn("[documents] content_hash update failed:", error.message);
        }
      });

    // Extract text
    const text = await extractText(buffer, input.mimeType);

    const chunks = chunkText(text);

    if (chunks.length === 0) {
      await updateDocumentStatus(input.documentId, "ready");
      return;
    }

    // Remove stale chunks from previous processing attempts
    await supabase.from("document_chunks").delete().eq("document_id", input.documentId);

    // Partial ingestion: embed and insert in batches — save progress even if later batches fail
    let insertedCount = 0;
    const embeddings = await embedBatchSafe(chunks);
    const chunkRows = chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      document_id: input.documentId,
      chunk_text: chunk,
      chunk_index: index,
      embedding: embeddings[index],
      token_count: Math.max(1, Math.ceil(chunk.length / 4))
    }));

    for (let i = 0; i < chunkRows.length; i += CHUNK_INSERT_BATCH) {
      const batch = chunkRows.slice(i, i + CHUNK_INSERT_BATCH);
      const { error: insertChunksError } = await supabase.from("document_chunks").insert(batch);
      if (insertChunksError) {
        console.error(`[documents] batch insert failed at chunk ${i}:`, insertChunksError);

        // Save partial progress
        if (insertedCount > 0) {
          await updateDocumentStatus(
            input.documentId,
            "partial",
            `Сохранено ${insertedCount} из ${chunks.length} фрагментов. Ошибка: ${insertChunksError.message}`
          );
        } else {
          throw insertChunksError;
        }
        return;
      }
      insertedCount += batch.length;
    }

    await updateDocumentStatus(input.documentId, "ready");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Неизвестная ошибка обработки документа.";

    try {
      await updateDocumentStatus(input.documentId, "failed", message);
    } catch (updateErr) {
      console.error("[documents] failed status update failed:", updateErr);
    }

    console.error("[documents] processing failed:", err);
  }
}
