import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  const telegramEnabled = Boolean(
    process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_WEBHOOK_SECRET
  );
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim();

  if (telegramEnabled && !botUsername) {
    console.error(
      "[CRITICAL][health] Telegram is enabled, but TELEGRAM_BOT_USERNAME is missing. Telegram deep-linking will be unavailable."
    );
  }

  return NextResponse.json({ ok: true, ts: Date.now() });
}
