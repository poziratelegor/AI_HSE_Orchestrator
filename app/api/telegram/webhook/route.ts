import { NextResponse } from "next/server";
import { ERRORS } from "@/lib/api/helpers";

export async function POST(request: Request) {
  // Telegram webhook верифицируется по секрет-токену, НЕ по Supabase auth.
  // Инвариант: ВСЕГДА отвечать 200 OK при успешной верификации — даже если обработка упала.
  // Иначе Telegram будет бесконечно ретраить запрос.

  const secret = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return ERRORS.UNAUTHORIZED();
  }

  let update: unknown = null;
  try {
    update = await request.json();
  } catch {
    // Невалидный JSON от Telegram — логируем, но всё равно отвечаем 200
    console.error("[telegram/webhook] Failed to parse update body");
  }

  try {
    // TODO: вызвать handleTelegramUpdate(update) из lib/telegram/handlers.ts
    void update;
  } catch (err) {
    // Ошибка обработки — логируем внутри, НЕ бросаем наружу
    console.error("[telegram/webhook] Error handling update:", err);
  }

  // Всегда 200 OK — инвариант Telegram webhook
  return NextResponse.json({ ok: true });
}

