import { getOpenAIClient } from "@/lib/ai/client";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

function buildSystemPrompt(today: string): string {
  return `
Составь учебный план подготовки. Возвращай ТОЛЬКО JSON:
{"goal":"цель из запроса",
 "total_days": N,
 "daily_plan":[
   {"day":1,"date":"YYYY-MM-DD","theme":"тема дня",
    "tasks":["задача1","задача2"],"duration_hours":2}
 ],
 "resources":["что изучить"],
 "tips":["совет"]}
Сегодня: ${today}. Если срок не указан — план на 7 дней.
`.trim();
}

type DailyPlanItem = {
  day: number;
  date: string;
  theme: string;
  tasks: string[];
  duration_hours: number;
};

type StudyPlanResult =
  | {
      ok: true;
      workflow: string;
      summary: string;
      data: {
        goal: string;
        total_days: number;
        daily_plan: DailyPlanItem[];
        resources: string[];
        tips: string[];
      };
    }
  | { ok: false; workflow: string; error: string; message: string };

export async function runStudyPlan(
  text: string,
  _ctx?: WorkflowContext
): Promise<StudyPlanResult> {
  const today = new Date().toISOString().slice(0, 10);
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          { role: "system", content: buildSystemPrompt(today) },
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
        goal?: string;
        total_days?: number;
        daily_plan?: DailyPlanItem[];
        resources?: string[];
        tips?: string[] | string;
      };

      const goal = parsed.goal ?? "Учебная цель";
      const total_days = parsed.total_days ?? (parsed.daily_plan?.length ?? 0);
      const daily_plan = parsed.daily_plan ?? [];
      const resources = parsed.resources ?? [];
      const tips = Array.isArray(parsed.tips) ? parsed.tips : parsed.tips ? [parsed.tips] : [];

      return {
        ok: true,
        workflow: "study_plan",
        summary: `${goal} — ${total_days} дн.`,
        data: { goal, total_days, daily_plan, resources, tips }
      };
    } catch {
      return {
        ok: false,
        workflow: "study_plan",
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
      workflow: "study_plan",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
