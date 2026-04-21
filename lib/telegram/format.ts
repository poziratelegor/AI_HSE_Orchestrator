/**
 * Унифицированное форматирование результатов workflow для Telegram.
 *
 * Зеркалит логику веб-компонента ResultBlock + AssistantClient.renderResult:
 * вытаскивает «человеческое» поле из любого ответа orchestrate, не валит JSON
 * пользователю в чат. Дополнительно знает Telegram-специфику:
 *  - лимит 4096 символов на сообщение → splitForTelegram()
 *  - заголовок-эмодзи для каждого workflow
 */

const TG_MESSAGE_LIMIT = 4000; // буфер 96 символов под markdown-обёртку

const WORKFLOW_TITLE: Record<string, string> = {
  letter_generator: "✉️ Письмо",
  task_extractor: "📝 Задачи",
  study_plan: "📅 Учебный план",
  explain_this: "💡 Объяснение",
  cheat_sheet: "📋 Шпаргалка",
  quiz_generator: "🎯 Тест",
  lecture_insight: "🎓 Конспект лекции",
  rag_qa: "📚 Ответ по документам",
};

type AnyObj = Record<string, unknown>;

function isObj(v: unknown): v is AnyObj {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Достаёт текстовое представление из data полей разных workflow.
 * Возвращает null если ничего узнаваемого не нашли.
 */
function pickFromData(data: AnyObj): string | null {
  // Письмо: subject + body
  if (typeof data.body === "string" && data.body.trim()) {
    const subject = typeof data.subject === "string" && data.subject.trim() ? data.subject.trim() : null;
    return subject ? `*${escapeMd(subject)}*\n\n${data.body}` : data.body;
  }
  if (typeof data.summary === "string" && data.summary.trim()) return data.summary;
  if (typeof data.explanation === "string" && data.explanation.trim()) return data.explanation;
  if (typeof data.answer === "string" && data.answer.trim()) return data.answer;
  if (typeof data.text === "string" && data.text.trim()) return data.text;
  if (typeof data.content === "string" && data.content.trim()) return data.content;
  if (typeof data.markdown === "string" && data.markdown.trim()) return data.markdown;

  // Задачи
  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    return data.tasks
      .map((t, i) => formatTaskItem(t, i + 1))
      .join("\n");
  }

  // Шпаргалка / план / списки
  if (Array.isArray(data.daily_plan) && data.daily_plan.length > 0) {
    return data.daily_plan
      .map((d) => {
        if (!isObj(d)) return String(d);
        const day = d.day ?? "?";
        const date = d.date ? ` (${d.date})` : "";
        const theme = d.theme ?? "";
        const tasks = Array.isArray(d.tasks) ? d.tasks.map((x) => `   • ${x}`).join("\n") : "";
        const hours = d.duration_hours ? ` — ~${d.duration_hours}ч` : "";
        return `*День ${day}${date}: ${theme}${hours}*\n${tasks}`;
      })
      .join("\n\n");
  }
  if (Array.isArray(data.questions) && data.questions.length > 0) {
    return data.questions
      .map((q, i) => {
        if (!isObj(q)) return `${i + 1}. ${String(q)}`;
        const opts = Array.isArray(q.options) ? q.options.join("\n") : "";
        return `*${i + 1}. ${q.question ?? ""}*\n${opts}\n_Ответ:_ ${q.correct ?? "?"}`;
      })
      .join("\n\n");
  }
  if (Array.isArray(data.key_ideas) && data.key_ideas.length > 0) {
    const summary = typeof data.summary === "string" ? `${data.summary}\n\n*Главные идеи:*\n` : "*Главные идеи:*\n";
    return summary + data.key_ideas.map((p, i) => `${i + 1}. ${p}`).join("\n");
  }
  if (Array.isArray(data.items) && data.items.length > 0) {
    return data.items.map((x, i) => `${i + 1}. ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n");
  }
  if (Array.isArray(data.points) && data.points.length > 0) {
    return data.points.map((x, i) => `${i + 1}. ${typeof x === "string" ? x : JSON.stringify(x)}`).join("\n");
  }
  if (typeof data.question === "string") return `❓ ${data.question}`;

  return null;
}

function formatTaskItem(t: unknown, n: number): string {
  if (typeof t === "string") return `${n}. ${t}`;
  if (!isObj(t)) return `${n}. ${String(t)}`;

  const title = (t.title ?? t.name ?? "Задача") as string;
  const due = (t.due_date ?? t.dueDate) as string | undefined | null;
  const prio = (t.priority ?? "") as string;

  const dueStr = due ? formatDueShort(due) : null;
  const prioEmoji = prio === "urgent" ? "🔥" : prio === "high" ? "⚡" : prio === "low" ? "🟢" : "📌";

  const extras = [dueStr ? `до ${dueStr}` : null].filter(Boolean).join(", ");
  return `${n}. ${prioEmoji} ${title}${extras ? ` _(${extras})_` : ""}`;
}

function formatDueShort(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

/**
 * Минимальное экранирование для parse_mode=Markdown (legacy, не V2).
 * Не трогает * и _ потому что мы их используем для форматирования —
 * только escape пары для текста-данных.
 */
export function escapeMd(s: string): string {
  return s.replace(/([`\[])/g, "\\$1");
}

export interface FormattedReply {
  /** Тексты сообщений (уже разбитые под лимит 4096 символов) */
  chunks: string[];
  /** Заголовок workflow (для логов / debug) */
  title: string;
  /** Workflow-имя если удалось распознать */
  workflow?: string;
}

/**
 * Главная точка входа: orchestrate-результат → массив сообщений для Telegram.
 *
 * Распаковывает {ok, intent, result: {workflow, data: {...}}} как ResultBlock,
 * добавляет emoji-заголовок, корректно дробит длинные тексты.
 */
export function formatOrchestrateResultForTelegram(result: unknown): FormattedReply {
  // Базовые случаи
  if (result === null || result === undefined) {
    return { chunks: ["Готово, но результат пуст."], title: "" };
  }
  if (typeof result === "string") {
    return { chunks: splitForTelegram(result), title: "" };
  }
  if (!isObj(result)) {
    return { chunks: [String(result)], title: "" };
  }

  // Ошибочный ответ
  if (result.ok === false) {
    const msg =
      (typeof result.message === "string" && result.message) ||
      (typeof (result as AnyObj).error === "string" && (result as AnyObj).error) ||
      "Произошла ошибка.";
    return { chunks: [`⚠️ ${String(msg)}`], title: "Ошибка" };
  }

  // Recommend zone (низкая уверенность)
  if (typeof result.suggestion === "string") {
    return { chunks: splitForTelegram(result.suggestion), title: "Подсказка" };
  }

  const inner = isObj(result.result) ? result.result : result;
  const data = isObj(inner.data) ? (inner.data as AnyObj) : (inner as AnyObj);
  const workflow = (inner.workflow ?? result.intent) as string | undefined;
  const title = workflow ? WORKFLOW_TITLE[workflow] ?? "Результат" : "Результат";

  // Clarification от orchestrator
  if (workflow === "route_recommender" || isObj(data) && typeof (data as AnyObj).question === "string") {
    const q = String((data as AnyObj).question ?? inner.summary ?? "Уточни запрос");
    return { chunks: [`❓ ${q}`], title: "Нужно уточнение", workflow };
  }

  const text = pickFromData(data as AnyObj);

  // Префикс с заголовком + summary, если есть
  const summary = typeof inner.summary === "string" && inner.summary.trim() ? inner.summary.trim() : null;
  const savedNote =
    workflow === "task_extractor" && typeof (data as AnyObj).saved === "number" && ((data as AnyObj).saved as number) > 0
      ? `\n\n_✓ Сохранено в трекер: ${(data as AnyObj).saved} шт._`
      : "";

  if (text) {
    const header = `*${title}*${summary ? ` — _${escapeMd(summary)}_` : ""}\n\n`;
    return { chunks: splitForTelegram(header + text + savedNote), title, workflow };
  }

  // Fallback — JSON, но коротко
  try {
    const json = JSON.stringify(inner, null, 2);
    return {
      chunks: [`*${title}*\n\n\`\`\`\n${json.slice(0, 3500)}${json.length > 3500 ? "\n…(обрезано)" : ""}\n\`\`\``],
      title,
      workflow,
    };
  } catch {
    return { chunks: ["Результат получен, но его не удалось отформатировать."], title, workflow };
  }
}

/**
 * Дробит длинный текст под лимит Telegram (4096 символов).
 * Старается резать по двойным переводам строки, потом по одинарным,
 * потом по пробелам — и только в крайнем случае «жёстко» по символам.
 */
export function splitForTelegram(text: string, limit = TG_MESSAGE_LIMIT): string[] {
  if (!text) return [""];
  if (text.length <= limit) return [text];

  const out: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n\n", limit);
    if (cut < limit / 2) cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = remaining.lastIndexOf(" ", limit);
    if (cut < 1) cut = limit;
    out.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) out.push(remaining);
  return out;
}
