import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import {
  BotUsernameMissingConfigError,
  generateLinkCode,
  LinkCodeRateLimitedError,
} from "@/lib/telegram/link";

export const runtime = "nodejs";

/**
 * POST /api/profile/telegram-link
 *
 * Генерирует одноразовый код привязки Telegram аккаунта (TTL 5 минут,
 * не более 3 кодов в час) и возвращает deep-link для открытия бота.
 *
 * Auth: требует залогиненного пользователя (Bearer токен Supabase сессии).
 */
export async function POST(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized", message: "Требуется авторизация" },
      { status: 401 }
    );
  }

  try {
    const link = await generateLinkCode(user.id);
    return NextResponse.json({
      ok: true,
      code: link.code,
      expiresAt: link.expiresAt,
      deepLink: link.deepLink,
      botUsername: link.botUsername,
    });
  } catch (err) {
    if (err instanceof LinkCodeRateLimitedError) {
      return NextResponse.json(
        { ok: false, error: "rate_limited", message: err.message },
        { status: 429, headers: { "Retry-After": "3600" } }
      );
    }

    if (err instanceof BotUsernameMissingConfigError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.code,
          reason: "Telegram bot username is missing in server configuration.",
          instruction:
            "Set TELEGRAM_BOT_USERNAME (without or with @) in environment variables and redeploy the app.",
          message: "Telegram-бот не сконфигурирован. Обратитесь к администратору.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "link_failed",
        message: err instanceof Error ? err.message : "Не удалось создать код",
      },
      { status: 500 }
    );
  }
}
