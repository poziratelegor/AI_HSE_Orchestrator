import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getProfile, isProfileComplete, upsertProfile } from "@/lib/supabase/profile";

/**
 * Server-side OAuth / Magic-link callback.
 *
 * Поток:
 *   1) Supabase редиректит сюда с ?code=<one_time_code>&next=/dashboard
 *   2) Обмениваем code → session (устанавливает sb-*-auth-token cookies через @supabase/ssr)
 *   3) Создаём минимальный профиль (если его нет) — full_name из Google meta + university="НИУ ВШЭ"
 *   4) Если профиль неполный → редирект на /complete-profile (анкета ВШЭ)
 *      Иначе → на next (дашборд)
 *
 * Почему server-side, а не клиентский useEffect:
 *   - Нет race condition с React strict mode (двойной запуск)
 *   - Один обмен code↔session → нет "ссылка устарела"
 *   - @supabase/ssr ставит чанкованные cookies сервером → всегда влезают
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/dashboard";
  // Защита от open-redirect: только локальные пути
  const safeNext = nextParam.startsWith("/") ? nextParam : "/dashboard";

  const errorDescription =
    searchParams.get("error_description") || searchParams.get("error");

  if (errorDescription) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", errorDescription);
    return NextResponse.redirect(loginUrl);
  }

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_callback");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await getSupabaseRouteClient();

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(loginUrl);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "auth_failed");
    return NextResponse.redirect(loginUrl);
  }

  // Минимальный профиль для свежего OAuth-юзера.
  // Ошибки апсёрта игнорируем — всё равно ведём на анкету.
  try {
    const existing = await getProfile(user.id, supabase);
    if (!existing) {
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const guessedName =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        null;

      await upsertProfile(
        user.id,
        {
          full_name: guessedName,
          email: user.email ?? null,
          university: "НИУ ВШЭ"
        },
        supabase
      );
    }
  } catch {
    // ignore
  }

  let profile = null;
  try {
    profile = await getProfile(user.id, supabase);
  } catch {
    profile = null;
  }

  const target = isProfileComplete(profile)
    ? safeNext
    : `/complete-profile?next=${encodeURIComponent(safeNext)}`;

  return NextResponse.redirect(new URL(target, origin));
}
