/**
 * Cron-эндпоинт: рассылка Telegram-уведомлений о приближающихся дедлайнах задач.
 *
 * Запускается из Vercel Cron (см. vercel.json) каждые 30 минут.
 * Идемпотентность: для каждой задачи проставляются notified_24h_at / notified_1h_at,
 * повторно одно и то же окно не отправится.
 *
 * Защита: либо Vercel Cron шлёт заголовок `Authorization: Bearer ${CRON_SECRET}`,
 * либо во входящем запросе должен быть query-параметр ?secret=${CRON_SECRET}.
 *
 * Окна срабатывания:
 *   24h: due_date в (now+22h ; now+26h)  — за ~сутки
 *   1h:  due_date в (now+30m ; now+90m)  — за ~час
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Window = "24h" | "1h";

type TaskRow = {
  id: string;
  user_id: string;
  title: string | null;
  due_date: string | null;
  priority: string | null;
  notified_24h_at: string | null;
  notified_1h_at: string | null;
};

type TgRow = {
  user_id: string | null;
  telegram_user_id: string;
};

function authorize(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Если секрет не настроен — отказываем по умолчанию.
    return false;
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

function priorityEmoji(priority: string | null): string {
  switch (priority) {
    case "urgent":
      return "🔥";
    case "high":
      return "⚡";
    case "low":
      return "🟢";
    default:
      return "📌";
  }
}

function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

function buildMessage(task: TaskRow, window: Window): string {
  const emoji = priorityEmoji(task.priority);
  const when = task.due_date ? formatDeadline(task.due_date) : "—";
  const lead = window === "24h" ? "⏰ Дедлайн через ~24 часа" : "🚨 Дедлайн через ~1 час";
  return [
    `${lead}`,
    "",
    `${emoji} *${escapeMd(task.title ?? "Без названия")}*`,
    `Срок: *${escapeMd(when)}*`,
    "",
    "_StudyFlow AI · напоминание_"
  ].join("\n");
}

// Минимальное экранирование Markdown (parse_mode: Markdown — не V2)
function escapeMd(s: string): string {
  return s.replace(/([_*`\[])/g, "\\$1");
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  const now = new Date();
  const in22h = new Date(now.getTime() + 22 * 3600 * 1000);
  const in26h = new Date(now.getTime() + 26 * 3600 * 1000);
  const in30m = new Date(now.getTime() + 30 * 60 * 1000);
  const in90m = new Date(now.getTime() + 90 * 60 * 1000);

  // 1) Кандидаты на 24h-окно
  const { data: tasks24, error: e24 } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_date, priority, notified_24h_at, notified_1h_at")
    .gte("due_date", in22h.toISOString())
    .lte("due_date", in26h.toISOString())
    .is("notified_24h_at", null)
    .neq("status", "done")
    .neq("status", "cancelled");

  if (e24) {
    console.error("[cron/deadlines] 24h query error:", e24.message);
    return NextResponse.json(
      { ok: false, error: "query_failed", message: e24.message },
      { status: 500 }
    );
  }

  // 2) Кандидаты на 1h-окно
  const { data: tasks1, error: e1 } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_date, priority, notified_24h_at, notified_1h_at")
    .gte("due_date", in30m.toISOString())
    .lte("due_date", in90m.toISOString())
    .is("notified_1h_at", null)
    .neq("status", "done")
    .neq("status", "cancelled");

  if (e1) {
    console.error("[cron/deadlines] 1h query error:", e1.message);
    return NextResponse.json(
      { ok: false, error: "query_failed", message: e1.message },
      { status: 500 }
    );
  }

  const buckets: { task: TaskRow; window: Window }[] = [
    ...((tasks24 ?? []) as TaskRow[]).map((t) => ({ task: t, window: "24h" as Window })),
    ...((tasks1 ?? []) as TaskRow[]).map((t) => ({ task: t, window: "1h" as Window }))
  ];

  if (buckets.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, total: 0 });
  }

  // 3) Получаем telegram_user_id для всех задействованных пользователей
  const userIds = Array.from(new Set(buckets.map((b) => b.task.user_id)));
  const { data: tgRows, error: tgErr } = await supabase
    .from("telegram_users")
    .select("user_id, telegram_user_id")
    .in("user_id", userIds);

  if (tgErr) {
    console.error("[cron/deadlines] telegram_users query error:", tgErr.message);
    return NextResponse.json(
      { ok: false, error: "query_failed", message: tgErr.message },
      { status: 500 }
    );
  }

  const tgByUser = new Map<string, string>();
  for (const row of (tgRows ?? []) as TgRow[]) {
    if (row.user_id && row.telegram_user_id) {
      tgByUser.set(row.user_id, row.telegram_user_id);
    }
  }

  // 4) Шлём + проставляем notified_*_at
  let sent = 0;
  let skipped = 0;
  const errors: { taskId: string; reason: string }[] = [];

  for (const { task, window } of buckets) {
    const tgId = tgByUser.get(task.user_id);
    if (!tgId) {
      // Telegram не привязан — просто помечаем как обработанное, чтобы не висело в выборке
      const patch = window === "24h"
        ? { notified_24h_at: now.toISOString() }
        : { notified_1h_at: now.toISOString() };
      await supabase.from("tasks").update(patch).eq("id", task.id);
      skipped += 1;
      continue;
    }

    try {
      await sendMessage({
        chatId: tgId,
        text: buildMessage(task, window),
        parseMode: "Markdown"
      });

      const patch = window === "24h"
        ? { notified_24h_at: now.toISOString() }
        : { notified_1h_at: now.toISOString() };
      const { error: updErr } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", task.id);
      if (updErr) {
        errors.push({ taskId: task.id, reason: `update failed: ${updErr.message}` });
        continue;
      }
      sent += 1;
    } catch (err) {
      errors.push({
        taskId: task.id,
        reason: err instanceof Error ? err.message : "unknown error"
      });
    }
  }

  return NextResponse.json({
    ok: true,
    sent,
    skipped,
    total: buckets.length,
    errors: errors.length > 0 ? errors : undefined
  });
}
