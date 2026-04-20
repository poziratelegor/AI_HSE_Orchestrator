import { getOpenAIClient } from "@/lib/ai/client";

const EXPAND_PROMPT = `
Ты помогаешь улучшить поиск по учебным материалам.
Дан вопрос студента. Сгенерируй 2 альтернативные формулировки этого же вопроса,
которые помогут найти больше релевантных фрагментов документов.

Правила:
- Перефразируй, используй синонимы, измени порядок слов
- Сохраняй смысл оригинального вопроса
- Одна формулировка должна быть более общей, другая — более конкретной
- Отвечай ТОЛЬКО JSON-массивом из 2 строк, без пояснений

Пример:
Вопрос: "Что такое градиентный спуск?"
Ответ: ["Как работает метод градиентного спуска в машинном обучении?", "Алгоритм оптимизации градиентный спуск"]
`.trim();

/**
 * Generates alternative query formulations to improve retrieval recall.
 * Returns the original query + up to 2 expansions.
 * Falls back to [originalQuery] on any error.
 */
export async function expandQuery(query: string): Promise<string[]> {
  if (!query.trim()) return [query];

  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 200,
        messages: [
          { role: "system", content: EXPAND_PROMPT },
          { role: "user", content: `Вопрос: "${query}"` }
        ]
      },
      { signal: controller.signal }
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed: unknown = JSON.parse(raw);

    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((v) => typeof v === "string")
    ) {
      // Prepend original, deduplicate
      const all = [query, ...parsed] as string[];
      return [...new Set(all.map((q) => q.trim()).filter(Boolean))];
    }

    return [query];
  } catch {
    // Silently fall back — retrieval still works with the original query
    return [query];
  } finally {
    clearTimeout(timeout);
  }
}
