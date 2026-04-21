import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/**
 * Service-role client — обходит RLS.
 * Использовать ТОЛЬКО в background jobs (chunk, embed, ingest).
 * Никогда не использовать для пользовательских запросов.
 */
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server env vars are missing");
  }

  return createClient(url, serviceKey);
}

/**
 * Server-side client с cookie-based сессией пользователя.
 * Использует @supabase/ssr — читает чанкованные cookies, выставленные браузерным
 * клиентом, и при необходимости обновляет их. RLS работает корректно.
 *
 * Используй в Server Components, Route Handlers и Server Actions, когда нужен
 * пользовательский контекст (auth.getUser()).
 */
export async function getSupabaseRouteClient(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase env vars are missing");
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // Server Component context — set cookies невозможен;
          // refresh handled via middleware
        }
      }
    }
  });
}

/**
 * Получить аутентифицированного пользователя из route handler.
 *
 * Совместимость со старыми API endpoints, ожидающими Authorization: Bearer header.
 * Создаёт anon-клиент с токеном пользователя → RLS работает корректно.
 *
 * Если Bearer-заголовка нет — пробует cookie-based сессию через @supabase/ssr.
 *
 * @returns { user } если токен валиден, либо { user: null } если нет токена/он истёк.
 */
export async function getSupabaseUserFromRequest(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase env vars are missing");
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { user: null };
    return { user: data.user };
  }

  // Fallback: cookie-based сессия
  try {
    const client = await getSupabaseRouteClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { user: null };
    return { user: data.user };
  } catch {
    return { user: null };
  }
}
