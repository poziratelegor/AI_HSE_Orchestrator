import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");

  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const update = await request.json().catch(() => null);

  return NextResponse.json({
    ok: true,
    message: "Telegram webhook placeholder",
    update
  });
}
