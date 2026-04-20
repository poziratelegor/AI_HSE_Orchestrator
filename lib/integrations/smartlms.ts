/**
 * SmartLMS HSE (Moodle) integration.
 *
 * HOW TO GET A TOKEN:
 *   1. Log in at https://lms.hse.ru
 *   2. Click your avatar → Profile
 *   3. Scroll to "User account" section → "Security keys"
 *   4. Under "Web service tokens", create a token for "Moodle mobile web service"
 *   5. Copy the token — this is the user's personal API key
 *
 * The token belongs to the user and accesses only their data — no admin access needed.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("integrations/smartlms");

const MOODLE_BASE_URL =
  process.env.SMARTLMS_BASE_URL ?? "https://lms.hse.ru/webservice/rest/server.php";

interface MoodleResponse<T> {
  exception?: string;
  errorcode?: string;
  message?: string;
  data?: T;
}

async function moodleCall<T>(
  token: string,
  wsfunction: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const body = new URLSearchParams({
    wstoken: token,
    wsfunction,
    moodlewsrestformat: "json",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  });

  const res = await fetch(MOODLE_BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000)
  });

  if (!res.ok) {
    throw new Error(`SmartLMS API returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as MoodleResponse<T> | T;

  // Moodle returns errors as top-level objects with 'exception' field
  if (
    json &&
    typeof json === "object" &&
    "exception" in json &&
    (json as MoodleResponse<T>).exception
  ) {
    const err = json as MoodleResponse<T>;
    throw new Error(`SmartLMS error [${err.errorcode}]: ${err.message}`);
  }

  return json as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SmartLMSCourse {
  id: number;
  shortname: string;
  fullname: string;
  summary: string;
  startdate: number; // Unix timestamp
  enddate: number;
}

export interface SmartLMSAssignment {
  id: number;
  courseId: number;
  courseName: string;
  name: string;
  intro: string; // HTML description
  duedate: number; // Unix timestamp (0 = no deadline)
  allowsubmissionsfromdate: number;
  grade: number;
}

export interface SmartLMSEvent {
  id: number;
  name: string;
  description: string;
  timestart: number;
  timeduration: number;
  eventtype: "course" | "user" | "group" | "category";
  courseid?: number;
  courseName?: string;
}

export interface SmartLMSSyncResult {
  courses: SmartLMSCourse[];
  assignments: SmartLMSAssignment[];
  upcomingEvents: SmartLMSEvent[];
}

// ─── API calls ───────────────────────────────────────────────────────────────

export async function getSmartLMSCourses(token: string): Promise<SmartLMSCourse[]> {
  const result = await moodleCall<{ courses: SmartLMSCourse[] }>(
    token,
    "core_course_get_enrolled_courses_by_timeline_classification",
    { classification: "inprogress", limit: 50, offset: 0 }
  );
  return result.courses ?? [];
}

export async function getSmartLMSAssignments(
  token: string,
  courseIds: number[]
): Promise<SmartLMSAssignment[]> {
  if (courseIds.length === 0) return [];

  const params: Record<string, string | number> = {};
  courseIds.forEach((id, i) => {
    params[`courseids[${i}]`] = id;
  });

  const result = await moodleCall<{ courses: Array<{ id: number; fullname: string; assignments: SmartLMSAssignment[] }> }>(
    token,
    "mod_assign_get_assignments",
    params
  );

  const assignments: SmartLMSAssignment[] = [];
  for (const course of result.courses ?? []) {
    for (const assignment of course.assignments ?? []) {
      assignments.push({
        ...assignment,
        courseId: course.id,
        courseName: course.fullname
      });
    }
  }

  return assignments.filter((a) => a.duedate > 0);
}

export async function getSmartLMSUpcomingEvents(token: string): Promise<SmartLMSEvent[]> {
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysLater = now + 30 * 24 * 60 * 60;

  const result = await moodleCall<{ events: SmartLMSEvent[] }>(
    token,
    "core_calendar_get_calendar_events",
    {
      "options[timestart]": now,
      "options[timeend]": thirtyDaysLater,
      "options[ignorehidden]": 1,
      "options[count]": 50
    }
  );

  return result.events ?? [];
}

/**
 * Full sync: fetches courses, assignments, and upcoming events.
 * Returns all data in one call — use this from the API route.
 */
export async function syncSmartLMS(token: string): Promise<SmartLMSSyncResult> {
  log.info("Starting SmartLMS sync");

  const courses = await getSmartLMSCourses(token);
  log.info(`Fetched ${courses.length} courses`);

  const courseIds = courses.map((c) => c.id);
  const [assignments, upcomingEvents] = await Promise.all([
    getSmartLMSAssignments(token, courseIds),
    getSmartLMSUpcomingEvents(token)
  ]);

  log.info(`Fetched ${assignments.length} assignments, ${upcomingEvents.length} events`);

  return { courses, assignments, upcomingEvents };
}
