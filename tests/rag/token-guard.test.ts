import { describe, it, expect } from "vitest";
import { estimateTokens, guardContext } from "@/lib/ai/token-guard";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

function makeChunk(id: string, text: string, similarity = 0.8): RetrievedChunk {
  return {
    id,
    document_id: "doc-1",
    document_title: "Test Document",
    chunk_text: text,
    chunk_index: 0,
    similarity,
  };
}

describe("estimateTokens", () => {
  it("estimates tokens for English text", () => {
    const tokens = estimateTokens("Hello world, this is a test.");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(20);
  });

  it("estimates tokens for Russian text", () => {
    const tokens = estimateTokens("Привет мир, это тест.");
    expect(tokens).toBeGreaterThan(0);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});

describe("guardContext", () => {
  it("returns all chunks when within budget", () => {
    const chunks = [
      makeChunk("1", "Короткий текст."),
      makeChunk("2", "Ещё короткий текст."),
    ];
    const result = guardContext(chunks, "gpt-4o-mini");
    expect(result).toHaveLength(2);
  });

  it("trims chunks that exceed budget", () => {
    const longText = "X".repeat(400_000); // ~114k tokens — exceeds budget
    const chunks = [
      makeChunk("1", "Первый чанк."),
      makeChunk("2", longText),
    ];
    const result = guardContext(chunks, "gpt-4o-mini");
    // Should include first chunk but not the second
    expect(result.length).toBeLessThan(chunks.length);
  });

  it("respects model-specific budgets", () => {
    const chunks = [makeChunk("1", "Текст.")];
    const result = guardContext(chunks, "gpt-3.5-turbo");
    expect(result).toHaveLength(1);
  });

  it("uses default budget for unknown model", () => {
    const chunks = [makeChunk("1", "Текст.")];
    const result = guardContext(chunks, "unknown-model");
    expect(result).toHaveLength(1);
  });
});
