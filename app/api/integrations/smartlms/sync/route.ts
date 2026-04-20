import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest, getSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { syncSmartLMS, type SmartLMSAssignment } from "@/lib/integrations/smartlms";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/integrations/smartlms");

/**
 * POST /api/integrations/smartlms/sync
 *
 * Body: { token: string }
 *
 * Syncs SmartLMS (Moodle) data for the authenticated user:
 *   - Saves/updates active courses
 *   - Creates tasks from assignments with deadlines
 *   - Returns summary of synced data
 *
 * TOKEN INSTRUCTIONS (include in UI):
 *   lms.hse.ru → Профиль → Ключи безопасности → Токен веб-сервиса
 */
export async function POST(request: Request) {
  // 1. Auth
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Rate limit
  const rl = await checkRateLimit(user.id, RATE_LIMITS.integration);
  if (!rl.allowed) return rl.response;

  // 3. Input validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { token } = body as Record<string, unknown>;

  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return ERRORS.INVALID_INPUT(
      "Поле 'token' обязательно. Получи токен на lms.hse.ru → Профиль → Ключи безопасности."
    );
  }

  // 4. Sync SmartLMS
  let syncResult: Awaited<ReturnType<typeof syncSmartLMS>>;
  try {
    syncResult = await syncSmartLMS(token.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка при обращении к SmartLMS.";
    log.warn("SmartLMS sync failed", { userId: user.id, error: message });

    if (message.includes("invalidtoken") || message.includes("Invalid token")) {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_token",
          message:
            "Недействительный токен SmartLMS. Проверь токен на lms.hse.ru → Профиль → Ключи безопасности."
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: false, error: "sync_error", message }, { status: 502 });
  }

  // 5. Save assignments as tasks in Supabase
  const supabase = getSupabaseServerClient();
  const { assignments } = syncResult;
  let tasksCreated = 0;
  let tasksSkipped = 0;

  for (const assignment of assignments) {
    if (!assignment.duedate || assignment.duedate <= 0) continue;

    const dueDate = new Date(assignment.duedate * 1000);
    const title = `[${assignment.courseName ?? "Курс"}] ${assignment.name}`;

    // Check if task already exists (by source_run_id holding the assignment id)
    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("user_id", user.id)
      .eq("title", title)
      .maybeSingle();

    if (existing) {
      tasksSkipped++;
      continue;
    }

    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      title,
      description: stripHtml(assignment.intro ?? ""),
      due_date: dueDate.toISOString(),
      status: "todo",
      source_run_id: null
    });

    if (error) {
      log.warn("Task insert failed", { userId: user.id, assignmentId: assignment.id, error: error.message });
    } else {
      tasksCreated++;
    }
  }

  log.info("SmartLMS sync complete", {
    userId: user.id,
    courses: syncResult.courses.length,
    assignments: assignments.length,
    tasksCreated,
    tasksSkipped
  });

  return NextResponse.json({
    ok: true,
    summary: {
      courses: syncResult.courses.length,
      assignments: assignments.length,
      tasksCreated,
      tasksSkipped,
      upcomingEvents: syncResult.upcomingEvents.length
    },
    courses: syncResult.courses.map((c) => ({
      id: c.id,
      name: c.fullname,
      shortname: c.shortname
    })),
    message: `Синхронизировано: ${syncResult.courses.length} курсов, создано ${tasksCreated} задач.`
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 500);
}
