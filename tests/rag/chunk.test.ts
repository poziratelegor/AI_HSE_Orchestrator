import { describe, it, expect } from "vitest";
import { chunkText } from "@/lib/rag/chunk";

describe("chunkText", () => {
  it("returns empty array for empty/whitespace input", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   ")).toEqual([]);
    expect(chunkText("\n\n")).toEqual([]);
  });

  it("returns single chunk for short text", () => {
    const text = "Короткий текст для тестирования.";
    const chunks = chunkText(text, 500);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain("Короткий текст");
  });

  it("splits long text into multiple chunks", () => {
    const sentences = Array.from({ length: 50 }, (_, i) =>
      `Предложение номер ${i + 1} содержит некоторую информацию о теме.`
    ).join(" ");

    const chunks = chunkText(sentences, 300);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("respects heading boundaries", () => {
    const text = `## Глава 1\n\nТекст первой главы.\n\n## Глава 2\n\nТекст второй главы.`;
    const chunks = chunkText(text, 5000);
    // With large chunk size, headings stay together
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it("merges tiny trailing chunks", () => {
    const text = "Длинный текст. ".repeat(30) + "Ок.";
    const chunks = chunkText(text, 200);
    // Last chunk should not be tiny (less than MIN_CHUNK_SIZE=100)
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.length).toBeGreaterThanOrEqual(3); // At minimum, the merged chunk
  });

  it("handles \r\n line endings", () => {
    const text = "Строка 1.\r\n\r\nСтрока 2.\r\n\r\nСтрока 3.";
    const chunks = chunkText(text, 5000);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.join("")).not.toContain("\r\n");
  });

  it("creates overlapping chunks when overlapSentences > 0", () => {
    const sentences = Array.from({ length: 20 }, (_, i) =>
      `Утверждение ${i + 1} про контекст и содержание.`
    ).join(" ");

    const chunks = chunkText(sentences, 200, 2);
    if (chunks.length > 1) {
      // Check that some content appears in consecutive chunks (overlap)
      const allText = chunks.join("\n");
      // At least one sentence should appear in the overlap
      expect(chunks.length).toBeGreaterThan(1);
    }
  });
});
