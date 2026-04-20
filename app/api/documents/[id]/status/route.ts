import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest, getSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

/**
 * GET /api/documents/[id]/status
 *
 * Returns the current processing status of a document.
 * Intended for polling after upload.
 *
 * Poll interval recommendation: 2s for first 30s, then 5s.
 * Stop polling when status is 'ready', 'failed', or 'partial'.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  const { id } = await params;

  if (!id || typeof id !== "string") {
    return ERRORS.INVALID_INPUT("Document ID is required.");
  }

  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, processing_status, error_message, created_at, mime_type, source_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return ERRORS.INTERNAL("Не удалось получить статус документа.");
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Документ не найден." },
      { status: 404 }
    );
  }

  // Count processed chunks for progress indication
  let chunksCount = 0;
  if (data.processing_status === "ready" || data.processing_status === "partial") {
    const { count } = await supabase
      .from("document_chunks")
      .select("*", { count: "exact", head: true })
      .eq("document_id", id);
    chunksCount = count ?? 0;
  }

  const isTerminal = ["ready", "failed", "partial"].includes(data.processing_status);

  return NextResponse.json({
    ok: true,
    document: {
      id: data.id,
      title: data.title,
      status: data.processing_status,
      errorMessage: data.error_message ?? null,
      chunksCount,
      mimeType: data.mime_type,
      sourceType: data.source_type,
      createdAt: data.created_at
    },
    isTerminal,
    // Polling hint: how many ms to wait before next poll
    retryAfterMs: isTerminal ? null : data.processing_status === "processing" ? 2000 : 3000
  });
}
