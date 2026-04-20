import type { RetrievedChunk } from "@/lib/rag/retrieve";

export interface Citation {
  chunk_id: string;
  document_id: string;
  document_title: string;
  /** First 200 chars of the chunk, for display in UI */
  excerpt: string;
  chunk_index: number;
  /** Cosine similarity score, rounded to 2 dp */
  similarity: number;
}

const EXCERPT_LENGTH = 200;

/**
 * Converts retrieved chunks into citation objects for the API response.
 * Sorted by similarity descending (most relevant first).
 */
export function buildCitations(chunks: RetrievedChunk[]): Citation[] {
  return [...chunks]
    .sort((a, b) => b.similarity - a.similarity)
    .map((chunk) => {
      const raw = chunk.chunk_text.trim();
      const excerpt =
        raw.length > EXCERPT_LENGTH
          ? raw.slice(0, EXCERPT_LENGTH).replace(/\s\S*$/, "") + "…"
          : raw;

      return {
        chunk_id: chunk.id,
        document_id: chunk.document_id,
        document_title: chunk.document_title || "Документ",
        excerpt,
        chunk_index: chunk.chunk_index,
        similarity: Math.round(chunk.similarity * 100) / 100
      };
    });
}
