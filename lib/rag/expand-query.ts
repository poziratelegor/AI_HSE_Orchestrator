import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { EXPAND_QUERY_PROMPT } from "@/lib/ai/prompts";

/**
 * Generates alternative query formulations to improve retrieval recall.
 * Returns the original query + up to 2 expansions.
 * Falls back to [originalQuery] on any error.
 *
 * The first expansion is more general, the second more specific —
 * see EXPAND_QUERY_PROMPT in lib/ai/prompts.ts.
 */
export async function expandQuery(query: string): Promise<string[]> {
  if (!query.trim()) return [query];

  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const completion = await withRetry(
      () =>
        openai.chat.completions.create(
          {
            model: DEFAULT_MODEL,
            temperature: 0.4,
            max_tokens: 250,
            messages: [
              { role: "system", content: EXPAND_QUERY_PROMPT },
              { role: "user", content: `Вопрос: "${query}"` }
            ]
          },
          { signal: controller.signal }
        ),
      2 // 2 attempts — fast fallback if LLM is flaky
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Strip accidental markdown code fences
    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: unknown = JSON.parse(clean);

    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((v) => typeof v === "string")
    ) {
      // Prepend original, deduplicate (case-insensitive)
      const all = [query, ...(parsed as string[])];
      const seen = new Set<string>();
      const deduped: string[] = [];
      for (const q of all) {
        const trimmed = q.trim();
        const key = trimmed.toLowerCase();
        if (trimmed && !seen.has(key)) {
          seen.add(key);
          deduped.push(trimmed);
        }
      }
      return deduped;
    }

    return [query];
  } catch {
    // Silently fall back — retrieval still works with the original query
    return [query];
  } finally {
    clearTimeout(timeout);
  }
}
