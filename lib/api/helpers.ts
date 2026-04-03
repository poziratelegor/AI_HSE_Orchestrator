import { NextResponse } from "next/server";

/**
 * Единый формат ошибочных ответов API.
 *
 * Все route handlers должны использовать эту функцию для ошибок.
 * Успешные ответы формируются напрямую через NextResponse.json({ ok: true, ... }).
 *
 * Примеры:
 *   apiError("unauthorized")              → 401
 *   apiError("invalid_input", "...", 400) → 400
 *   apiError("internal_error", "...", 500)→ 500
 */
export function apiError(
  error: string,
  message?: string,
  status: number = 400
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error,
      message: message ?? error
    },
    { status }
  );
}

export const ERRORS = {
  UNAUTHORIZED: () =>
    apiError("unauthorized", "Требуется авторизация.", 401),

  INVALID_INPUT: (message: string) =>
    apiError("invalid_input", message, 400),

  INTERNAL: (message = "Внутренняя ошибка сервера.") =>
    apiError("internal_error", message, 500)
} as const;
