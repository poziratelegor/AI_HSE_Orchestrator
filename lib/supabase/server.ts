import { createClient } from "@supabase/supabase-js";

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
 * Получить аутентифицированного пользователя из route handler.
 *
 * Ожидает заголовок: Authorization: Bearer <supabase_access_token>
 * Создаёт anon-клиент с токеном пользователя → RLS работает корректно.
 *
 * @returns { user } если токен валиден, либо { user: null } если нет токена или он истёк.
 */
export async function getSupabaseUserFromRequest(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase env vars are missing");
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { user: null };
  }

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });

  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return { user: null };
  }

  return { user: data.user };
}
