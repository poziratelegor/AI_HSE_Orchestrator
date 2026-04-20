import { getOpenAIClient } from "@/lib/ai/client";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

function buildSystemPrompt(count: number): string {
  return `
Создай тест для самопроверки. Возвращай ТОЛЬКО JSON:
{"questions":[
  {"question":"...","options":["A)...","B)...","C)...","D)..."],
   "correct":"A","explanation":"почему правильно"}
]}
Количество вопросов: ${count}.
Вопросы разного уровня сложности.
`.trim();
}

/** Parse question count from text like "5 вопросов", "10 questions", "3 вопроса". */
function parseQuestionCount(text: string): number {
  const match = /(\d+)\s*(?:вопрос|question)/i.exec(text);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n > 0 && n <= 20) return n;
  }
  return 5;
}

type QuizQuestion = {
  question: string;
  options: string[];
  correct: string;
  explanation: string;
};

type QuizResult =
  | {
      ok: true;
      workflow: string;
      summary: string;
      data: { questions: QuizQuestion[]; count: number };
    }
  | { ok: false; workflow: string; error: string; message: string };

export async function runQuizGenerator(
  text: string,
  _ctx?: WorkflowContext
): Promise<QuizResult> {
  const questionCount = parseQuestionCount(text);
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.4,
        max_tokens: 2000,
        messages: [
          { role: "system", content: buildSystemPrompt(questionCount) },
          { role: "user", content: `Составь тест по следующему материалу:\n\n${text}` }
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
      const parsed = JSON.parse(clean) as { questions?: QuizQuestion[] };
      const questions = parsed.questions ?? [];

      return {
        ok: true,
        workflow: "quiz_generator",
        summary: `Тест: ${questions.length} вопрос${questions.length === 1 ? "" : questions.length < 5 ? "а" : "ов"}`,
        data: { questions, count: questions.length }
      };
    } catch {
      return {
        ok: false,
        workflow: "quiz_generator",
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
      workflow: "quiz_generator",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
