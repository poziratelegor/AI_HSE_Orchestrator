import { getSupabaseRouteClient } from "@/lib/supabase/server";

/**
 * Получить ID текущего пользователя из cookies (server-side).
 *
 * Использует @supabase/ssr, который корректно читает чанкованные cookies
 * (sb-{ref}-auth-token.0, .1, ...), выставленные браузерным клиентом.
 */
export async function getCurrentUserIdFromCookies(): Promise<string | null> {
  try {
    const supabase = await getSupabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Получить полный объект пользователя + его роль.
 * Для разграничения доступа в layout/страницах.
 */
export async function getCurrentUserWithRole(): Promise<{
  userId: string | null;
  role: "user" | "admin" | null;
  fullName: string | null;
  email: string | null;
}> {
  try {
    const supabase = await getSupabaseRouteClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { userId: null, role: null, fullName: null, email: null };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const p = (profile ?? {}) as { role?: string; full_name?: string };
    return {
      userId: user.id,
      role: p.role === "admin" ? "admin" : "user",
      fullName: p.full_name ?? null,
      email: user.email ?? null
    };
  } catch {
    return { userId: null, role: null, fullName: null, email: null };
  }
}
