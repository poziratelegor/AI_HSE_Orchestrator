import type { SupabaseClient } from "@supabase/supabase-js";

export type ProfileData = {
  full_name?: string | null;
  email?: string | null;
  university?: string | null;
  faculty?: string | null;
  group_name?: string | null;
  course_number?: number | null;
};

/**
 * Профиль считается заполненным, если указаны все обязательные поля студента.
 */
export function isProfileComplete(profile: ProfileData | null): boolean {
  if (!profile) return false;
  return !!(
    profile.full_name?.trim() &&
    profile.university?.trim() &&
    profile.faculty?.trim() &&
    profile.group_name?.trim() &&
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
    .select("full_name, email, university, faculty, group_name, course_number")
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
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...data }, { onConflict: "id" });
  return { error: error?.message ?? null };
}
