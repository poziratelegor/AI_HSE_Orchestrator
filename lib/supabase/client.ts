import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie-based storage adapter for the Supabase browser client.
 *
 * Why: The plain @supabase/supabase-js client defaults to localStorage,
 * but our Next.js middleware reads auth state from HTTP cookies
 * (pattern: sb-*-auth-token). Without cookie storage the middleware
 * redirects authenticated users to /login.
 *
 * The value is URI-encoded so the middleware can safely
 * `JSON.parse(decodeURIComponent(cookie.value))`.
 */
function makeCookieStorage() {
  return {
    getItem(key: string): string | null {
      if (typeof document === "undefined") return null;
      const name = encodeURIComponent(key) + "=";
      for (const part of document.cookie.split("; ")) {
        if (part.startsWith(name)) {
          return decodeURIComponent(part.slice(name.length));
        }
      }
      return null;
    },
    setItem(key: string, value: string): void {
      if (typeof document === "undefined") return;
      // 7-day session cookie, readable by middleware (no HttpOnly)
      document.cookie = [
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
        "path=/",
        "max-age=604800",
        "SameSite=Lax"
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
 * Returns a singleton Supabase browser client.
 * Session is persisted to cookies so Next.js middleware can read it.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase browser env vars are missing");
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
