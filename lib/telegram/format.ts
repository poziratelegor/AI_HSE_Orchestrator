/**
 * Унифицированное форматирование результатов workflow для Telegram.
 */

import { normalizeOrchestrateResult } from "@/lib/orchestrator/normalize-result";

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
  route_recommender: "❓ Нужно уточнение",
};

export interface FormattedReply {
  /** Тексты сообщений (уже разбитые под лимит 4096 символов) */
  chunks: string[];
  /** Заголовок workflow (для логов / debug) */
  title: string;
  /** Workflow-имя если удалось распознать */
  workflow?: string;
}

/**
 * Минимальное экранирование для parse_mode=Markdown (legacy, не V2).
 */
export function escapeMd(s: string): string {
  return s.replace(/([`\[])/g, "\\$1");
}

/**
 * Главная точка входа: orchestrate-результат → массив сообщений для Telegram.
 */
export function formatOrchestrateResultForTelegram(result: unknown): FormattedReply {
  const normalized = normalizeOrchestrateResult(result);
  const title = normalized.workflow ? (WORKFLOW_TITLE[normalized.workflow] ?? normalized.title) : normalized.title;

  if (normalized.status === "error") {
    return { chunks: [`⚠️ ${normalized.text || "Произошла ошибка."}`], title, workflow: normalized.workflow };
  }

  if (normalized.status === "clarification") {
    return { chunks: splitForTelegram(`❓ ${normalized.text}`), title, workflow: normalized.workflow };
  }

  if (normalized.isDebugFallback) {
    return {
      chunks: [
        `*${title || "Результат"}*\n\n_debug-case: raw-json-fallback_\n\n\`\`\`\n${normalized.text.slice(0, 3500)}${normalized.text.length > 3500 ? "\n…(обрезано)" : ""}\n\`\`\``,
      ],
      title,
      workflow: normalized.workflow,
    };
  }

  const headerSubtitle = normalized.subtitle ? ` — _${escapeMd(normalized.subtitle)}_` : "";
  const header = `*${title || "Результат"}*${headerSubtitle}\n\n`;
  return {
    chunks: splitForTelegram(header + normalized.text),
    title,
    workflow: normalized.workflow,
  };
}

/**
 * Дробит длинный текст под лимит Telegram (4096 символов).
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
