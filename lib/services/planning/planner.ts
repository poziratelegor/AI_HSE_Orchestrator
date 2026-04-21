import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { buildStudyPlanPrompt } from "@/lib/ai/prompts";
import { loadStudentContext } from "@/lib/ai/student-context";
import type { WorkflowContext } from "@/lib/orchestrator/executor";

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
  ctx?: WorkflowContext
): Promise<StudyPlanResult> {
  const today = new Date().toISOString().slice(0, 10);
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  // Load student context for course-level adaptation (cached)
  const studentCtx = ctx?.userId ? await loadStudentContext(ctx.userId) : null;
  const systemPrompt = buildStudyPlanPrompt(today, studentCtx);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create(
        {
          model: DEFAULT_MODEL,
          temperature: 0.3,
          max_tokens: 2500,
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
      // Graceful degradation: return raw LLM text as the plan
      return {
        ok: true,
        workflow: "study_plan",
        summary: "Учебный план (свободная форма)",
        data: { goal: "Учебный план", total_days: 0, daily_plan: [], resources: [raw], tips: [] }
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
