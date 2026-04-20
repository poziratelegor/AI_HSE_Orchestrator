import { getOpenAIClient } from "@/lib/ai/client";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

const SYSTEM_PROMPT = `
Создай краткую шпаргалку по теме. Структура ТОЛЬКО JSON:
{"title":"название темы",
 "definitions":[{"term":"...","definition":"..."}],
 "formulas":["формула или правило"],
 "examples":["краткий пример"],
 "tips":["совет для запоминания"]}
`.trim();

type CheatSheetResult =
  | {
      ok: true;
      workflow: string;
      summary: string;
      data: {
        title: string;
        definitions: { term: string; definition: string }[];
        formulas: string[];
        examples: string[];
        tips: string[];
      };
    }
  | { ok: false; workflow: string; error: string; message: string };

export async function runCheatSheet(
  text: string,
  _ctx?: WorkflowContext
): Promise<CheatSheetResult> {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.2,
        max_tokens: 1500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Создай шпаргалку по следующей теме или тексту:\n\n${text}` }
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
        title?: string;
        definitions?: { term: string; definition: string }[];
        formulas?: string[];
        examples?: string[];
        tips?: string[];
      };

      const title = parsed.title ?? "Шпаргалка";
      const definitions = parsed.definitions ?? [];
      const formulas = parsed.formulas ?? [];
      const examples = parsed.examples ?? [];
      const tips = parsed.tips ?? [];

      return {
        ok: true,
        workflow: "cheat_sheet",
        summary: title,
        data: { title, definitions, formulas, examples, tips }
      };
    } catch {
      return {
        ok: false,
        workflow: "cheat_sheet",
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
      workflow: "cheat_sheet",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
