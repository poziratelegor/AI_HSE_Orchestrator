/**
 * Cron-эндпоинт: рассылка Telegram-уведомлений о приближающихся дедлайнах задач.
 *
 * Запускается из Vercel Cron (см. vercel.json) ежедневно в 06:00 UTC (~09:00 МСК).
 * Hobby-план Vercel поддерживает только daily-расписание, поэтому окна выбраны
 * под утреннюю дайджест-рассылку:
 *   • "сегодня"  — задачи с дедлайном сегодня после now
 *   • "завтра"   — задачи с дедлайном в течение завтрашних суток
 *
 * Идемпотентность через колонки notified_1h_at (сегодня) и notified_24h_at (завтра):
 * проставляем их при отправке, повторно в то же окно не уйдёт.
 *
 * Защита: Vercel Cron шлёт `Authorization: Bearer ${CRON_SECRET}`,
 * либо можно дернуть руками с `?secret=${CRON_SECRET}`.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendMessage } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Window = "today" | "tomorrow";

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
  const lead = window === "today" ? "🚨 Дедлайн сегодня" : "⏰ Дедлайн завтра";
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

  // Границы "сегодня" и "завтра" в МСК (UTC+3) — чтобы дайджест был привязан к
  // календарному дню пользователя, а не к UTC. Москва без перехода на летнее время.
  const MSK_OFFSET_MS = 3 * 3600 * 1000;
  const mskNow = new Date(now.getTime() + MSK_OFFSET_MS);
  const startOfTodayMsk = new Date(
    Date.UTC(mskNow.getUTCFullYear(), mskNow.getUTCMonth(), mskNow.getUTCDate())
  );
  const startOfTodayUtc = new Date(startOfTodayMsk.getTime() - MSK_OFFSET_MS);
  const startOfTomorrowUtc = new Date(startOfTodayUtc.getTime() + 24 * 3600 * 1000);
  const startOfDayAfterUtc = new Date(startOfTodayUtc.getTime() + 48 * 3600 * 1000);

  // 1) "Сегодня" — дедлайн в [now ; конец сегодняшнего дня по МСК]
  const { data: tasksToday, error: eToday } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_date, priority, notified_24h_at, notified_1h_at")
    .gte("due_date", now.toISOString())
    .lt("due_date", startOfTomorrowUtc.toISOString())
    .is("notified_1h_at", null)
    .neq("status", "done")
    .neq("status", "cancelled");

  if (eToday) {
    console.error("[cron/deadlines] today query error:", eToday.message);
    return NextResponse.json(
      { ok: false, error: "query_failed", message: eToday.message },
      { status: 500 }
    );
  }

  // 2) "Завтра" — дедлайн в [начало завтра ; начало послезавтра] по МСК
  const { data: tasksTomorrow, error: eTomorrow } = await supabase
    .from("tasks")
    .select("id, user_id, title, due_date, priority, notified_24h_at, notified_1h_at")
    .gte("due_date", startOfTomorrowUtc.toISOString())
    .lt("due_date", startOfDayAfterUtc.toISOString())
    .is("notified_24h_at", null)
    .neq("status", "done")
    .neq("status", "cancelled");

  if (eTomorrow) {
    console.error("[cron/deadlines] tomorrow query error:", eTomorrow.message);
    return NextResponse.json(
      { ok: false, error: "query_failed", message: eTomorrow.message },
      { status: 500 }
    );
  }

  const buckets: { task: TaskRow; window: Window }[] = [
    ...((tasksToday ?? []) as TaskRow[]).map((t) => ({ task: t, window: "today" as Window })),
    ...((tasksTomorrow ?? []) as TaskRow[]).map((t) => ({ task: t, window: "tomorrow" as Window }))
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
      const patch = window === "tomorrow"
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

      const patch = window === "tomorrow"
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
