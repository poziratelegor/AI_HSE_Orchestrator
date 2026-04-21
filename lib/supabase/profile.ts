import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campus, EducationLevel } from "@/lib/hse/programs";

export type ProfileData = {
  full_name?: string | null;
  email?: string | null;
  university?: string | null;
  faculty?: string | null;
  group_name?: string | null;
  course_number?: number | null;
  /** Кампус ВШЭ (moscow / spb / nnov / perm) — добавлено в миграции 0007 */
  campus?: Campus | string | null;
  /** Ступень обучения (bachelor / master / specialist / phd) — добавлено в миграции 0007 */
  education_level?: EducationLevel | string | null;
  /** Образовательная программа — добавлено в миграции 0007 */
  program?: string | null;
};

const MAX_FULL_NAME_LENGTH = 120;
const MAX_GROUP_NAME_LENGTH = 32;

function normalizeGroupName(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value
    .trim()
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!compact) return null;

  // Пример: БПИ241 / БПИ-241 -> БПИ-241
  const simple = compact.match(/^([A-ZА-ЯЁ]+)-?(\d{2,4})$/u);
  if (simple) {
    return `${simple[1]}-${simple[2]}`.slice(0, MAX_GROUP_NAME_LENGTH);
  }

  // Пример: МИВ21_1 / МИВ21-1 / МИВ-21-1 -> МИВ-21-1
  const splitYearGroup = compact.match(/^([A-ZА-ЯЁ]+)-?(\d{1,2})-?(\d{1,2})$/u);
  if (splitYearGroup) {
    return `${splitYearGroup[1]}-${splitYearGroup[2]}-${splitYearGroup[3]}`.slice(
      0,
      MAX_GROUP_NAME_LENGTH
    );
  }

  return compact.slice(0, MAX_GROUP_NAME_LENGTH);
}

const PROFILE_COLUMNS =
  "full_name, email, university, faculty, group_name, course_number, campus, education_level, program";

/**
 * Профиль считается заполненным, если указаны все обязательные поля студента.
 *
 * Обязательные: full_name, university, faculty, course_number.
 * Дополнительно для новых профилей: campus, education_level.
 * group_name и program — опциональные.
 */
export function isProfileComplete(profile: ProfileData | null): boolean {
  if (!profile) return false;
  return !!(
    profile.full_name?.trim() &&
    profile.university?.trim() &&
    profile.faculty?.trim() &&
    profile.course_number
  );
}

/**
 * Получить профиль пользователя из таблицы profiles.
 * Использует переданный клиент (browser или server) — RLS применяется соответственно.
 */
export async function getProfile(
  userId: string,
  supabase: SupabaseClient
): Promise<ProfileData | null> {
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();
  return data as ProfileData | null;
}

/**
 * Создать или обновить профиль пользователя.
 * Использует upsert с onConflict: "id" — безопасно для первого создания и обновлений.
 */
export async function upsertProfile(
  userId: string,
  data: ProfileData,
  supabase: SupabaseClient
): Promise<{ error: string | null }> {
  const sanitized: ProfileData = {
    ...data,
    full_name: data.full_name?.trim().slice(0, MAX_FULL_NAME_LENGTH) ?? null,
    group_name: normalizeGroupName(data.group_name),
  };

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...sanitized }, { onConflict: "id" });
  return { error: error?.message ?? null };
}
