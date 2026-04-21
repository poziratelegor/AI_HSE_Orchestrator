import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { buildExplainPrompt } from "@/lib/ai/prompts";
import { loadStudentContext } from "@/lib/ai/student-context";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

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
  ctx?: WorkflowContext
): Promise<ExplainResult> {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // Load student context for course-level adaptation (cached)
  const studentCtx = ctx?.userId ? await loadStudentContext(ctx.userId) : null;
  const systemPrompt = buildExplainPrompt(studentCtx);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create(
        {
          model: DEFAULT_MODEL,
          temperature: 0.5,
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ]
        },
        { signal: controller.signal }
      )
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
      // Graceful degradation: return raw LLM text as the explanation
      return {
        ok: true,
        workflow: "explain_this",
        summary: raw.slice(0, 80) + (raw.length > 80 ? "…" : ""),
        data: { explanation: raw, key_terms: [], analogy: "" }
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
