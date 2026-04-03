import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Auth Callback — обрабатывает OAuth redirect и magic link.
 *
 * Supabase перенаправляет сюда после успешной аутентификации с параметрами:
 * - ?code=<auth_code>  (OAuth PKCE flow)
 * - или #access_token=... (implicit flow, обрабатывается клиентом автоматически)
 *
 * Обменивает code на сессию и редиректит на /dashboard (или ?next= если задан).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? url.origin;

  if (!code) {
    // Нет кода — возможно implicit flow (фрагмент #access_token обрабатывается клиентом)
    // Редиректим на /dashboard, браузерный Supabase-клиент сам подхватит токен из хэша
    return NextResponse.redirect(new URL(next, appUrl));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    console.error("[auth/callback] Missing Supabase env vars");
    return NextResponse.redirect(new URL("/login?error=config", appUrl));
  }

  try {
    const supabase = createClient(supabaseUrl, anonKey);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] exchangeCodeForSession error:", error.message);
      return NextResponse.redirect(new URL("/login?error=auth_callback", appUrl));
    }

    return NextResponse.redirect(new URL(next, appUrl));
  } catch (err) {
    console.error("[auth/callback] Unexpected error:", err);
    return NextResponse.redirect(new URL("/login?error=unexpected", appUrl));
  }
}
