import { getOpenAIClient } from "@/lib/openai/client";

const SYSTEM_PROMPT = `
Ты — ассистент для написания официальных академических писем на русском языке.
Пиши строго официально, вежливо, структурированно и по делу.
Тон: уважительный, академический, без лишних слов и воды.

Структура письма:
- Приветствие (Уважаемый / Уважаемая...)
- Суть обращения
- Обоснование или просьба
- Заключительная формула вежливости
- Подпись (С уважением, Студент)

Возвращай ответ СТРОГО в формате JSON без markdown и без пояснений:
{"subject":"Краткая тема письма","body":"Полный текст письма"}
`.trim();

type LetterResult = {
  ok: true;
  workflow: string;
  summary: string;
  data: { subject: string; body: string };
} | {
  ok: false;
  workflow: string;
  error: string;
  message: string;
};

export async function runLetterGenerator(text: string): Promise<LetterResult> {
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.3,
        max_tokens: 1000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Напиши официальное письмо на основе следующего запроса студента:\n\n${text}`
          }
        ]
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";

    // Strip accidental markdown code fences if model adds them
    const clean = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(clean) as { subject?: string; body?: string };
      return {
        ok: true,
        workflow: "letter_generator",
        summary: parsed.subject ?? "Официальное письмо",
        data: {
          subject: parsed.subject ?? "Официальное обращение",
          body: parsed.body ?? clean
        }
      };
    } catch {
      // JSON parse failed — use raw text as body, still a usable result
      return {
        ok: true,
        workflow: "letter_generator",
        summary: "Официальное письмо",
        data: {
          subject: "Официальное обращение",
          body: raw
        }
      };
    }
  } catch (err: unknown) {
    clearTimeout(timeout);

    const isAbort =
      err instanceof Error && (err.name === "AbortError" || err.message.includes("abort"));

    return {
      ok: false,
      workflow: "letter_generator",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
