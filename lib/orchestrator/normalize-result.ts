export type NormalizedStatus = "ok" | "clarification" | "error";

type AnyObj = Record<string, unknown>;

export interface NormalizedOrchestrateResult {
  title: string;
  text: string;
  subtitle?: string;
  workflow?: string;
  status: NormalizedStatus;
  isDebugFallback?: boolean;
}

const WORKFLOW_TITLE: Record<string, string> = {
  letter_generator: "Письмо",
  task_extractor: "Задачи",
  study_plan: "Учебный план",
  explain_this: "Объяснение",
  cheat_sheet: "Шпаргалка",
  quiz_generator: "Тест",
  lecture_insight: "Конспект лекции",
  rag_qa: "Ответ по документам",
  route_recommender: "Нужно уточнение",
};

function isObj(v: unknown): v is AnyObj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function formatStudyPlan(data: AnyObj): string | null {
  if (!Array.isArray(data.daily_plan) || data.daily_plan.length === 0) return null;

  const goal = typeof data.goal === "string" && data.goal.trim() ? data.goal.trim() : "Учебный план";
  const totalDays =
    typeof data.total_days === "number" && Number.isFinite(data.total_days)
      ? data.total_days
      : data.daily_plan.length;

  const planLines = data.daily_plan.map((item, index) => {
    if (typeof item === "string") return `${index + 1}. ${item}`;

    const row = item as AnyObj;
    const day = typeof row.day === "number" ? `День ${row.day}` : `День ${index + 1}`;
    const date = typeof row.date === "string" && row.date.trim() ? ` (${row.date})` : "";
    const theme = typeof row.theme === "string" && row.theme.trim() ? row.theme : "Тема не указана";
    const duration =
      typeof row.duration_hours === "number" && Number.isFinite(row.duration_hours)
        ? ` · ${row.duration_hours} ч`
        : "";

    const tasks =
      Array.isArray(row.tasks) && row.tasks.length > 0
        ? row.tasks.map((t) => `   - ${typeof t === "string" ? t : JSON.stringify(t)}`).join("\n")
        : "   - Без уточнённых задач";

    return `${day}${date}: ${theme}${duration}\n${tasks}`;
  });

  const resources =
    Array.isArray(data.resources) && data.resources.length > 0
      ? `\n\nРесурсы:\n${data.resources.map((r) => `- ${typeof r === "string" ? r : JSON.stringify(r)}`).join("\n")}`
      : "";

  const tips =
    Array.isArray(data.tips) && data.tips.length > 0
      ? `\n\nСоветы:\n${data.tips.map((t) => `- ${typeof t === "string" ? t : JSON.stringify(t)}`).join("\n")}`
      : "";

  return `${goal} (${totalDays} дн.)\n\n${planLines.join("\n\n")}${resources}${tips}`.trim();
}

function pickText(data: AnyObj): string | null {
  if (typeof data.body === "string" && data.body.trim()) return data.body;
  if (typeof data.explanation === "string" && data.explanation.trim()) return data.explanation;
  if (typeof data.answer === "string" && data.answer.trim()) return data.answer;
  if (typeof data.text === "string" && data.text.trim()) return data.text;
  if (typeof data.content === "string" && data.content.trim()) return data.content;
  if (typeof data.markdown === "string" && data.markdown.trim()) return data.markdown;

  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    return data.tasks
      .map((t, i) => {
        if (typeof t === "string") return `${i + 1}. ${t}`;
        const r = t as AnyObj;
        const title = (r.title ?? r.name ?? "Задача") as string;
        const due = r.due_date || r.dueDate;
        const prio = r.priority;
        const extras = [due ? `до ${due}` : null, prio ? `приоритет: ${prio}` : null].filter(Boolean).join(", ");
        return `${i + 1}. ${title}${extras ? ` (${extras})` : ""}`;
      })
      .join("\n");
  }

  if (Array.isArray(data.questions) && data.questions.length > 0) {
    return data.questions
      .map((q, i) => {
        if (!isObj(q)) return `${i + 1}. ${String(q)}`;
        const options = Array.isArray(q.options)
          ? q.options.map((opt) => `   - ${typeof opt === "string" ? opt : JSON.stringify(opt)}`).join("\n")
          : "";
        const correct = typeof q.correct === "string" ? `\nОтвет: ${q.correct}` : "";
        return `${i + 1}. ${q.question ?? "Вопрос"}${options ? `\n${options}` : ""}${correct}`;
      })
      .join("\n\n");
  }

  if (Array.isArray(data.key_ideas) && data.key_ideas.length > 0) {
    const ideas = data.key_ideas.map((idea, i) => `${i + 1}. ${String(idea)}`).join("\n");
    const summaryPrefix = typeof data.summary === "string" && data.summary.trim() ? `${data.summary}\n\n` : "";
    return `${summaryPrefix}Главные идеи:\n${ideas}`;
  }

  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items.map((x, i) => `${i + 1}. ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n");
  }
  if (Array.isArray(data.points) && data.points.length > 0) {
    return data.points.map((x, i) => `${i + 1}. ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n");
  }

  const studyPlan = formatStudyPlan(data);
  if (studyPlan) return studyPlan;

  if (typeof data.summary === "string" && data.summary.trim()) return data.summary;

  return null;
}

export function normalizeOrchestrateResult(result: unknown): NormalizedOrchestrateResult {
  if (result === null || result === undefined) {
    return {
      title: "Результат",
      text: "",
      status: "error",
    };
  }

  if (typeof result === "string") {
    return {
      title: "Результат",
      text: result,
      status: "ok",
    };
  }

  if (!isObj(result)) {
    return {
      title: "Результат",
      text: String(result),
      status: "ok",
    };
  }

  if (result.ok === false) {
    const message =
      (typeof result.message === "string" && result.message) ||
      (typeof result.error === "string" && result.error) ||
      "Произошла ошибка.";

    return {
      title: "Ошибка",
      text: message,
      status: "error",
    };
  }

  if (typeof result.suggestion === "string" && result.suggestion.trim()) {
    return {
      title: "Нужно уточнение",
      text: result.suggestion.trim(),
      status: "clarification",
      workflow: "route_recommender",
    };
  }

  const inner = isObj(result.result) ? result.result : result;
  const data = isObj(inner.data) ? inner.data : inner;
  const workflow = (inner.workflow ?? result.intent) as string | undefined;
  const summary = typeof inner.summary === "string" ? inner.summary : undefined;
  const subject = typeof data.subject === "string" ? data.subject : undefined;
  const title = workflow ? (WORKFLOW_TITLE[workflow] ?? "Результат") : "Результат";

  if (workflow === "route_recommender" || (isObj(data) && typeof data.question === "string")) {
    return {
      title: "Нужно уточнение",
      text: String((data as AnyObj).question ?? summary ?? "Уточните запрос"),
      workflow,
      subtitle: summary,
      status: "clarification",
    };
  }

  const text = pickText(data);
  if (text) {
    return {
      title,
      text,
      subtitle: subject ?? summary,
      workflow,
      status: "ok",
    };
  }

  return {
    title,
    text: JSON.stringify(inner, null, 2),
    subtitle: "debug-case",
    workflow,
    status: "ok",
    isDebugFallback: true,
  };
}
