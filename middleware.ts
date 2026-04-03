import type { NextRequest } from "next/server";
import { withAuthGuard } from "@/lib/supabase/middleware";

/**
 * Next.js Middleware — защищает все /dashboard/* роуты.
 *
 * Если пользователь не аутентифицирован → редирект на /login?next=<path>
 *
 * Публичные роуты (/, /login, /signup, /api/*, /api/telegram/webhook) не затрагиваются.
 * Финальная верификация токена происходит в каждом route handler через getUser().
 */
export default function middleware(request: NextRequest) {
  return withAuthGuard(request);
}

export const config = {
  matcher: [
    /*
     * Защищаем только /dashboard и его подпути.
     * Исключаем Next.js internals и статику.
     */
    "/dashboard/:path*"
  ]
};
