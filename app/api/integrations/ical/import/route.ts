import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest, getSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { checkRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";
import { parseIcal, filterUpcomingEvents } from "@/lib/integrations/ical";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/integrations/ical");

/**
 * POST /api/integrations/ical/import
 *
 * Accepts either:
 *   - multipart/form-data with field "file" (.ics file)
 *   - application/json with field "content" (raw .ics text)
 *   - application/json with field "url" (iCal URL to fetch from)
 *
 * Creates tasks in Supabase from VEVENT entries with DTSTART.
 */
export async function POST(request: Request) {
  // 1. Auth
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Rate limit
  const rl = await checkRateLimit(user.id, RATE_LIMITS.integration);
  if (!rl.allowed) return rl.response;

  // 3. Parse input
  let icsContent = "";
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return ERRORS.INVALID_INPUT("Не удалось прочитать форму.");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return ERRORS.INVALID_INPUT("Поле 'file' обязательно (.ics файл).");
    }

    if (!file.name.endsWith(".ics") && file.type !== "text/calendar") {
      return ERRORS.INVALID_INPUT("Файл должен быть в формате .ics (iCalendar).");
    }

    icsContent = await file.text();
  } else {
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return ERRORS.INVALID_INPUT("Тело запроса должно быть JSON или multipart с .ics файлом.");
    }

    if (typeof body.content === "string") {
      icsContent = body.content;
    } else if (typeof body.url === "string") {
      // Fetch iCal from URL (e.g., Google Calendar public URL)
      try {
        const res = await fetch(body.url, {
          headers: { "User-Agent": "StudyFlowBot/1.0" },
          signal: AbortSignal.timeout(10_000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        icsContent = await res.text();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Ошибка загрузки";
        return NextResponse.json(
          { ok: false, error: "fetch_error", message: `Не удалось загрузить iCal: ${msg}` },
          { status: 422 }
        );
      }
    } else {
      return ERRORS.INVALID_INPUT("Укажи 'file', 'content' или 'url'.");
    }
  }

  if (!icsContent.includes("BEGIN:VCALENDAR")) {
    return ERRORS.INVALID_INPUT("Файл не является валидным iCal (.ics) форматом.");
  }

  // 4. Parse events
  const allEvents = parseIcal(icsContent);
  const upcoming = filterUpcomingEvents(allEvents, 180);

  if (upcoming.length === 0) {
    return NextResponse.json({
      ok: true,
      tasksCreated: 0,
      tasksSkipped: 0,
      totalEvents: allEvents.length,
      message: "В календаре не найдено предстоящих событий на ближайшие 6 месяцев."
    });
  }

  // 5. Insert tasks
  const supabase = getSupabaseServerClient();
  let tasksCreated = 0;
  let tasksSkipped = 0;

  for (const event of upcoming) {
    if (!event.summary || !event.start) continue;

    const title = event.summary.slice(0, 255);

    // Dedup by title + due_date
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

    const description = [
      event.description ? `📝 ${event.description.slice(0, 300)}` : "",
      event.location ? `📍 ${event.location}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("tasks").insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      title,
      description: description || null,
      due_date: event.start.toISOString(),
      status: "pending",
      source_run_id: null
    });

    if (error) {
      log.warn("Task insert failed", { userId: user.id, title, error: error.message });
    } else {
      tasksCreated++;
    }
  }

  log.info("iCal import complete", {
    userId: user.id,
    totalEvents: allEvents.length,
    upcoming: upcoming.length,
    tasksCreated,
    tasksSkipped
  });

  return NextResponse.json({
    ok: true,
    totalEvents: allEvents.length,
    upcomingEvents: upcoming.length,
    tasksCreated,
    tasksSkipped,
    message: `Импортировано ${tasksCreated} задач из ${upcoming.length} предстоящих событий.`
  });
}
