import { NextRequest, NextResponse } from "next/server";

/**
 * Извлекает payload из Supabase JWT без верификации подписи.
 *
 * Верификация подписи происходит в Supabase при вызове getUser() в route handlers.
 * В middleware нам достаточно проверить наличие и срок действия токена,
 * чтобы не делать сетевой запрос на каждый переход страницы.
 *
 * Если токен истёк или отсутствует — редиректим на /login.
 * Финальная верификация подлинности всегда происходит в route handlers через getUser().
 */
function decodeJwtPayload(token: string): { exp?: number; sub?: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Edge Runtime поддерживает atob()
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(padded);
    return JSON.parse(decoded) as { exp?: number; sub?: string };
  } catch {
    return null;
  }
}

function getTokenFromRequest(request: NextRequest): string | null {
  // Supabase JS-клиент хранит сессию в cookie вида: sb-<project-ref>-auth-token
  // RequestCookies iterator даёт [name: string, cookie: { name, value }]
  for (const [name, cookie] of request.cookies) {
    if (name.startsWith("sb-") && name.endsWith("-auth-token")) {
      const rawValue: string = cookie.value;
      try {
        // Значение может быть JSON: { access_token, refresh_token, ... }
        const parsed = JSON.parse(decodeURIComponent(rawValue)) as {
          access_token?: string;
        };
        if (parsed.access_token) return parsed.access_token;
      } catch {
        // Не JSON — само значение является токеном
        return rawValue;
      }
    }
  }
  return null;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

/**
 * Guard для защищённых роутов в Next.js middleware.
 *
 * Проверяет наличие и срок действия Supabase access token из cookie.
 * При отсутствии или истечении — редиректит на /login?next=<path>.
 *
 * Финальная проверка подлинности всегда происходит в route handlers через getUser().
 *
 * Использование в /middleware.ts:
 *   import { withAuthGuard } from "@/lib/supabase/middleware";
 *   export default withAuthGuard;
 *   export const config = { matcher: ["/dashboard/:path*"] };
 */
export function withAuthGuard(request: NextRequest): NextResponse {
  const token = getTokenFromRequest(request);

  if (!token) {
    return redirectToLogin(request);
  }

  const payload = decodeJwtPayload(token);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!payload || !payload.sub) {
    return redirectToLogin(request);
  }

  if (payload.exp !== undefined && payload.exp < nowSeconds) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}
