import type { NextRequest } from "next/server";
import { withAuthGuard } from "@/lib/supabase/middleware";

/**
 * Next.js Middleware — защищает /dashboard/* и /complete-profile.
 *
 * Если пользователь не аутентифицирован → редирект на /login?next=<path>
 * Публичные роуты (/, /login, /signup, /callback, /api/*) не затрагиваются.
 */
export default function middleware(request: NextRequest) {
  return withAuthGuard(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/complete-profile"
  ]
};
