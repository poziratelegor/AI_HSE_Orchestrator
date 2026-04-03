import { embedText } from "@/lib/rag/embed";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export interface RetrievedChunk {
  id: string;
  document_id: string;
  chunk_text: string;
  chunk_index: number;
  similarity: number;
  document_title: string;
}

export interface RetrieveOptions {
  /** Minimum cosine similarity (0–1). Default 0.5 */
  matchThreshold?: number;
  /** Maximum number of chunks to return. Default 5 */
  matchCount?: number;
}

/**
 * Embeds the query and performs a vector similarity search against
 * document_chunks, filtered to the given user's documents.
 *
 * Requires the `match_document_chunks` SQL function (0002_match_function.sql).
 */
export async function retrieveRelevantChunks(
  query: string,
  userId: string,
  opts: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { matchThreshold = 0.5, matchCount = 5 } = opts;

  const queryEmbedding = await embedText(query);
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    p_user_id: userId
  });

  if (error) {
    throw new Error(`Vector search failed: ${error.message}`);
  }

  return (data ?? []) as RetrievedChunk[];
}
