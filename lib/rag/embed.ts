import { getOpenAIClient } from "@/lib/ai/client";

/**
 * Embeds a single string using text-embedding-3-small (1536 dims).
 * Returns a float array suitable for pgvector storage.
 */
export async function embedText(text: string): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new Error("embedText: empty input");
  }

  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.trim(),
    encoding_format: "float"
  });

  return response.data[0].embedding;
}

/**
 * Embeds multiple strings in a single API call (batched).
 * More efficient than calling embedText() in a loop.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((t) => t.trim()),
    encoding_format: "float"
  });

  // API returns items in the same order as input
  return response.data.sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

const BATCH_SIZE = 100;

/**
 * Embeds texts in safe batches of up to 100 items.
 * Prevents hitting OpenAI's per-request input limit.
 */
export async function embedBatchSafe(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await embedBatch(batch);
    results.push(...embeddings);
  }
  return results;
}
