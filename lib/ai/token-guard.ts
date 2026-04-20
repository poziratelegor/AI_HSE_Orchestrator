import type { RetrievedChunk } from "@/lib/rag/retrieve";

/**
 * Rough token estimation.
 * Rule of thumb: 1 token ≈ 4 characters for English, ≈ 3 characters for Russian.
 * We use 3.5 as a conservative middle ground.
 */
const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Model context limits (leaving room for system prompt + answer).
 * Values are conservative — actual limits are higher but we need buffer.
 */
const MODEL_TOKEN_BUDGETS: Record<string, number> = {
  "gpt-4o": 100_000,
  "gpt-4o-mini": 100_000,
  "gpt-4-turbo": 100_000,
  "gpt-3.5-turbo": 12_000
};

const DEFAULT_BUDGET = 80_000;

/** Reserved for system prompt + user question + answer generation */
const RESERVED_TOKENS = 3_000;

/**
 * Trims retrieved chunks to fit within the model's context budget.
 * Keeps chunks in order (most relevant first) and drops from the end.
 *
 * @returns subset of chunks that fit within the token budget
 */
export function guardContext(
  chunks: RetrievedChunk[],
  model: string,
  systemPromptLength = 0,
  questionLength = 0
): RetrievedChunk[] {
  const budget =
    (MODEL_TOKEN_BUDGETS[model] ?? DEFAULT_BUDGET) -
    RESERVED_TOKENS -
    estimateTokens(systemPromptLength.toString()) -
    estimateTokens(questionLength.toString());

  let used = 0;
  const result: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.chunk_text);
    if (used + chunkTokens > budget) break;
    result.push(chunk);
    used += chunkTokens;
  }

  if (result.length < chunks.length) {
    console.warn(
      `[token-guard] Trimmed context from ${chunks.length} to ${result.length} chunks ` +
        `(~${used} tokens used of ${budget} budget)`
    );
  }

  return result;
}
