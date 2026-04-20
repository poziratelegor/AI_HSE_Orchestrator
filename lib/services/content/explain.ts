import { getOpenAIClient } from "@/lib/ai/client";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

const SYSTEM_PROMPT = `
Объясни следующий текст простыми словами для студента.
Избегай сложных терминов. Если термин необходим — объясни его.
Возвращай ТОЛЬКО JSON:
{"explanation":"...","key_terms":[{"term":"...","simple":"..."}],
 "analogy":"понятная аналогия если уместна"}
`.trim();

type ExplainResult =
  | {
      ok: true;
      workflow: string;
      summary: string;
      data: {
        explanation: string;
        key_terms: { term: string; simple: string }[];
        analogy: string;
      };
    }
  | { ok: false; workflow: string; error: string; message: string };

export async function runExplainThis(
  text: string,
  _ctx?: WorkflowContext
): Promise<ExplainResult> {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.5,
        max_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text }
        ]
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(clean) as {
        explanation?: string;
        key_terms?: { term: string; simple: string }[];
        analogy?: string;
      };

      const explanation = parsed.explanation ?? raw;
      const key_terms = parsed.key_terms ?? [];
      const analogy = parsed.analogy ?? "";

      return {
        ok: true,
        workflow: "explain_this",
        summary: explanation.slice(0, 80) + (explanation.length > 80 ? "…" : ""),
        data: { explanation, key_terms, analogy }
      };
    } catch {
      return {
        ok: false,
        workflow: "explain_this",
        error: "parse_error",
        message: "Не удалось разобрать ответ модели как JSON."
      };
    }
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    return {
      ok: false,
      workflow: "explain_this",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
