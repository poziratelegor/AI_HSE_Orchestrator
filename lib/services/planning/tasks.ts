import { getOpenAIClient } from "@/lib/ai/client";
import type { WorkflowContext } from "@/lib/orchestrator/executor";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function buildSystemPrompt(today: string): string {
  return `
Извлеки все задачи и дедлайны из текста. Возвращай ТОЛЬКО JSON:
{"tasks":[
  {"title":"...","description":"...","due_date":"ISO8601 или null",
   "priority":"low|medium|high|urgent"}
]}
Если дедлайн относительный ("через неделю") — вычисли от сегодня.
Сегодня: ${today}
`.trim();
}

type TaskItem = {
  title: string;
  description: string;
  due_date: string | null;
  priority: "low" | "medium" | "high" | "urgent";
};

type TaskExtractorResult =
  | {
      ok: true;
      workflow: string;
      summary: string;
      data: { tasks: TaskItem[]; saved: number };
    }
  | { ok: false; workflow: string; error: string; message: string };

async function saveTasks(tasks: TaskItem[], userId: string): Promise<number> {
  const supabase = getSupabaseServerClient();
  const rows = tasks.map((t) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    priority: t.priority,
    status: "pending"
  }));

  const { error } = await supabase.from("tasks").insert(rows);
  if (error) {
    console.error("[tasks] insert failed:", error);
    return 0;
  }
  return rows.length;
}

export async function runTaskExtractor(
  text: string,
  ctx?: WorkflowContext
): Promise<TaskExtractorResult> {
  const today = new Date().toISOString().slice(0, 10);
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        temperature: 0.1,
        max_tokens: 1500,
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
      const parsed = JSON.parse(clean) as { tasks?: TaskItem[] };
      const tasks = parsed.tasks ?? [];

      const saved = ctx?.userId ? await saveTasks(tasks, ctx.userId) : 0;

      return {
        ok: true,
        workflow: "task_extractor",
        summary: `Найдено ${tasks.length} задач${tasks.length === 1 ? "а" : tasks.length < 5 ? "и" : ""}`,
        data: { tasks, saved }
      };
    } catch {
      return {
        ok: false,
        workflow: "task_extractor",
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
      workflow: "task_extractor",
      error: isAbort ? "timeout" : "openai_error",
      message: isAbort
        ? "Запрос к OpenAI превысил таймаут 30 секунд."
        : err instanceof Error
        ? err.message
        : "Неизвестная ошибка OpenAI."
    };
  }
}
