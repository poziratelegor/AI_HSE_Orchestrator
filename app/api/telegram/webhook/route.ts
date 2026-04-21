import { NextResponse } from "next/server";
import { ERRORS } from "@/lib/api/helpers";
import { handleTelegramUpdate } from "@/lib/telegram/handlers";
import { trackEvent } from "@/lib/analytics/events";
import { ANALYTICS_EVENTS } from "@/lib/constants/analytics";

export async function POST(request: Request) {
  // Telegram webhook верифицируется по секрет-токену, НЕ по Supabase auth.
  // Инвариант: ВСЕГДА отвечать 200 OK при успешной верификации — даже если обработка упала.
  // Иначе Telegram будет бесконечно ретраить запрос.

  // Webhook secret ОБЯЗАТЕЛЕН. Если не задан — это misconfiguration, а не
  // открытый webhook. Без secret любой может POST'ать fake-апдейты с
  // подделанным from.id и привязать чужой код или слить наш OpenAI-баланс.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) {
    console.error("[telegram/webhook] TELEGRAM_WEBHOOK_SECRET is missing or too short (<16 chars). Rejecting.");
    return NextResponse.json(
      { ok: false, error: "webhook_misconfigured" },
      { status: 500 }
    );
  }
  const incoming = request.headers.get("x-telegram-bot-api-secret-token");
  if (incoming !== secret) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: unknown = null;
  try {
    update = await request.json();
  } catch {
    // Невалидный JSON от Telegram — логируем, но всё равно отвечаем 200
    console.error("[telegram/webhook] Failed to parse update body");
  }

  try {
    await handleTelegramUpdate(update);

    void trackEvent(ANALYTICS_EVENTS.ORCHESTRATE_SUCCESS, {
      channel: "telegram",
      workflow: "telegram_webhook",
      meta: {
        handled: true
      }
    });
  } catch (err) {
    // Ошибка обработки — логируем внутри, НЕ бросаем наружу
    console.error("[telegram/webhook] Error handling update:", err);

    void trackEvent(ANALYTICS_EVENTS.ORCHESTRATE_ERROR, {
      channel: "telegram",
      workflow: "telegram_webhook",
      errorCode: err instanceof Error ? err.name : "telegram_handler_error",
      meta: {
        message: err instanceof Error ? err.message : "Unknown telegram webhook error"
      }
    });
  }

  // Всегда 200 OK — инвариант Telegram webhook
  return NextResponse.json({ ok: true });
}
