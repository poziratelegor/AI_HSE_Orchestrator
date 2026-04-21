import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

let browserClient: SupabaseClient | null = null;

/**
 * Singleton Supabase browser client.
 *
 * Использует @supabase/ssr → cookies автоматически режутся на чанки
 * (sb-{ref}-auth-token.0, .1, .2 ...) и читаются из document.cookie.
 * Это критично для OAuth: токен с user_metadata от Google легко превышает
 * 4 КБ и в одной cookie не помещается.
 *
 * Безопасен при SSR/build: при отсутствии env vars возвращает placeholder.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    if (typeof window === "undefined") {
      return createClient("https://placeholder.supabase.co", "placeholder_key_for_ssr");
    }
    throw new Error(
      "Supabase browser env vars are missing. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  browserClient = createBrowserClient(url, anonKey, {
    cookieOptions: SUPABASE_COOKIE_OPTIONS
  });
  return browserClient;
}
