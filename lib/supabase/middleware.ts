import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Guard для защищённых роутов в Next.js middleware.
 *
 * Использует @supabase/ssr → корректно читает чанкованные cookies
 * (sb-{ref}-auth-token.0, .1, ...) и при необходимости обновляет access token.
 *
 * Если пользователь не аутентифицирован → редирект на /login?next=<path>.
 * Финальная проверка через getUser() обращается к Supabase Auth API.
 */
export async function withAuthGuard(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // env vars не заданы — пропускаем (build/SSR без credentials)
    return NextResponse.next();
  }

  // Создаём response, который будем возвращать (или модифицируем cookies на нём)
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options as CookieOptions);
        }
      }
    }
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
