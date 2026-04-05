import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-based storage adapter — сессия хранится в cookie, а не localStorage,
 * чтобы middleware мог читать auth-state.
 */
function makeCookieStorage() {
  return {
    getItem(key: string): string | null {
      if (typeof document === "undefined") return null;
      const name = encodeURIComponent(key) + "=";
      for (const part of document.cookie.split("; ")) {
        if (part.startsWith(name)) return decodeURIComponent(part.slice(name.length));
      }
      return null;
    },
    setItem(key: string, value: string): void {
      if (typeof document === "undefined") return;
      document.cookie = [
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        "path=/", "max-age=604800", "SameSite=Lax"
      ].join("; ");
    },
    removeItem(key: string): void {
      if (typeof document === "undefined") return;
      document.cookie = `${encodeURIComponent(key)}=; path=/; max-age=0; SameSite=Lax`;
    }
  };
}

let browserClient: SupabaseClient | null = null;

/**
 * Singleton Supabase browser client.
 *
 * Безопасен при SSR-проходе Next.js 15 (build-time):
 * все реальные вызовы (.auth.getUser, .from() и т.д.) происходят только в
 * useEffect и event handlers — то есть только на клиенте.
 * При SSR без env vars возвращает placeholder-клиент, чтобы компонент
 * мог отрендерить начальный HTML без ошибок.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Во время SSR/build без env vars — возвращаем placeholder.
  // Клиент не будет делать реальных запросов во время серверного рендера,
  // поэтому это безопасно. В браузере без переменных — бросаем.
  if (!url || !anonKey) {
    if (typeof window === "undefined") {
      return createClient("https://placeholder.supabase.co", "placeholder_key_for_ssr");
    }
    throw new Error(
      "Supabase browser env vars are missing. " +
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      storage: makeCookieStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  });

  return browserClient;
}
