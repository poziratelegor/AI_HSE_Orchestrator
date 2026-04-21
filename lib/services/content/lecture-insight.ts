import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { buildLectureInsightPrompt } from "@/lib/ai/prompts";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

type LectureInsightResult =
  | {
      ok: true;
      workflow: string;
      summary: string;
      data: {
        topics: string[];
        terms: { term: string; definition: string }[];
        key_ideas: string[];
        summary: string;
      };
    }
  | { ok: false; workflow: string; error: string; message: string };

export async function runLectureInsight(
  text: string,
  _ctx?: WorkflowContext
): Promise<LectureInsightResult> {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create(
        {
          model: DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 2500,
          messages: [
            { role: "system", content: buildLectureInsightPrompt() },
            { role: "user", content: `Проанализируй следующий текст лекции:\n\n${text}` }
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
        topics?: string[];
        terms?: { term: string; definition: string }[];
        key_ideas?: string[];
        summary?: string;
      };

      const topics = parsed.topics ?? [];
      const terms = parsed.terms ?? [];
      const key_ideas = parsed.key_ideas ?? [];
      const summary = parsed.summary ?? "";

      return {
        ok: true,
        workflow: "lecture_insight",
        summary: topics[0] ?? "Анализ лекции",
        data: { topics, terms, key_ideas, summary }
      };
    } catch {
      // Graceful degradation: return raw LLM text as the summary
      return {
        ok: true,
        workflow: "lecture_insight",
        summary: "Анализ лекции",
        data: { topics: [], terms: [], key_ideas: [], summary: raw }
      };
    }
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));
    return {
      ok: false,
      workflow: "lecture_insight",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
