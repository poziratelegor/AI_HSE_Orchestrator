import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("student-context");

/**
 * Profile context that personalizes all assistant responses.
 *
 * Fetched once per workflow invocation and injected into system prompts
 * so the assistant can address the student by name, reference their faculty,
 * adjust language complexity to their course year, etc.
 */
export interface StudentContext {
  userId: string;
  fullName?: string;
  email?: string;
  university?: string;
  faculty?: string;
  groupName?: string;
  courseNumber?: number;
  studentId?: string;
}

const _cache = new Map<string, { value: StudentContext; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Loads the student's profile from Supabase.
 *
 * Cached in-memory for 5 minutes to avoid repeated DB queries during
 * a single user session. Returns minimal context (just userId) on miss/error
 * — workflows always have something to interpolate.
 */
export async function loadStudentContext(userId: string): Promise<StudentContext> {
  // Cache check
  const cached = _cache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.value;
  }

  const fallback: StudentContext = { userId };

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, email, university, faculty, group_name, course_number, student_id, program")
      .eq("id", userId)
      .single();

    // Фолбэк на auth.users.user_metadata (Google OAuth кладёт туда name/full_name).
    // Запрашиваем всегда — даже если профиль есть, но full_name пустой.
    let metaFullName: string | undefined;
    let metaEmail: string | undefined;
    try {
      const { data: authData } = await supabase.auth.admin.getUserById(userId);
      const meta = (authData?.user?.user_metadata ?? {}) as Record<string, unknown>;
      const name = typeof meta.full_name === "string" ? meta.full_name : typeof meta.name === "string" ? meta.name : undefined;
      if (name && name.trim()) metaFullName = name.trim();
      if (authData?.user?.email) metaEmail = authData.user.email;
    } catch {
      // молча — service-role может быть недоступен
    }

    if (error || !data) {
      const minimal: StudentContext = {
        userId,
        fullName: metaFullName,
        email: metaEmail
      };
      _cache.set(userId, { value: minimal, expires: Date.now() + CACHE_TTL_MS });
      return minimal;
    }

    const facultyParts: string[] = [];
    if (data.faculty) facultyParts.push(data.faculty);
    if (data.program) facultyParts.push(`ОП «${data.program}»`);

    const ctx: StudentContext = {
      userId,
      fullName: data.full_name ?? metaFullName ?? undefined,
      email: data.email ?? metaEmail ?? undefined,
      university: data.university ?? undefined,
      faculty: facultyParts.length > 0 ? facultyParts.join(", ") : undefined,
      groupName: data.group_name ?? undefined,
      courseNumber: data.course_number ?? undefined,
      studentId: data.student_id ?? undefined,
    };

    _cache.set(userId, { value: ctx, expires: Date.now() + CACHE_TTL_MS });
    return ctx;
  } catch (err) {
    logger.warn("Failed to load student context", { userId, error: String(err) });
    return fallback;
  }
}

/**
 * Renders a compact, human-readable summary of the student for system prompts.
 *
 * Returns a multiline block like:
 *   ИНФОРМАЦИЯ О СТУДЕНТЕ:
 *   - Имя: Иван Петров
 *   - ВУЗ: НИУ ВШЭ
 *   - Факультет: Компьютерных наук
 *   - Группа: БПИ-211
 *   - Курс: 3
 *
 * Returns empty string if no profile data available — workflows handle this gracefully.
 */
export function renderStudentContextBlock(ctx: StudentContext | null | undefined): string {
  if (!ctx) return "";

  const lines: string[] = [];
  if (ctx.fullName) lines.push(`- Имя: ${ctx.fullName}`);
  if (ctx.university) lines.push(`- ВУЗ: ${ctx.university}`);
  if (ctx.faculty) lines.push(`- Факультет: ${ctx.faculty}`);
  if (ctx.groupName) lines.push(`- Группа: ${ctx.groupName}`);
  if (ctx.courseNumber) lines.push(`- Курс: ${ctx.courseNumber}`);

  if (lines.length === 0) return "";

  return `ИНФОРМАЦИЯ О СТУДЕНТЕ:\n${lines.join("\n")}\n`;
}

/** Test helper — clears the in-memory cache. */
export function _clearStudentContextCache() {
  _cache.clear();
}
