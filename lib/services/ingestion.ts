import { chunkText } from "@/lib/rag/chunk";
import { embedBatch } from "@/lib/rag/embed";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type ProcessDocumentInput = {
  documentId: string;
  storagePath: string;
  mimeType: string;
};

type DocumentStatus = "pending" | "processing" | "ready" | "failed";

async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  errorMessage?: string
) {
  const supabase = getSupabaseServerClient();
  const fullPayload = {
    processing_status: status,
    status,
    error_message: errorMessage ?? null
  };

  const { error } = await supabase.from("documents").update(fullPayload).eq("id", documentId);

  if (!error) return;

  const maybeMissingExtendedColumns =
    error.message.includes("status") || error.message.includes("error_message");

  if (!maybeMissingExtendedColumns) {
    throw error;
  }

  const { error: fallbackError } = await supabase
    .from("documents")
    .update({ processing_status: status })
    .eq("id", documentId);

  if (fallbackError) {
    throw fallbackError;
  }
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

    if (input.mimeType !== "text/plain") {
      throw new Error(`MIME type ${input.mimeType} пока не поддерживается в processing pipeline.`);
    }

    const text = await fileData.text();
    const chunks = chunkText(text);

    if (chunks.length > 0) {
      const embeddings = await embedBatch(chunks);
      const chunkRows = chunks.map((chunk, index) => ({
        id: crypto.randomUUID(),
        document_id: input.documentId,
        chunk_text: chunk,
        chunk_index: index,
        embedding: embeddings[index]
      }));

      const { error: insertChunksError } = await supabase.from("document_chunks").insert(chunkRows);

      if (insertChunksError) {
        throw insertChunksError;
      }
    }

    await updateDocumentStatus(input.documentId, "ready");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Неизвестная ошибка обработки документа.";

    try {
      await updateDocumentStatus(input.documentId, "failed", message);
    } catch (updateErr) {
      console.error("[documents] failed status update failed:", updateErr);
    }

    console.error("[documents] processing failed:", err);
  }
}
