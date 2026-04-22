import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/profile/telegram-link
 *
 * Endpoint deprecated: Telegram web-link flow has been removed.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "gone",
      message: "Telegram linking via profile is no longer supported.",
    },
    { status: 410 }
  );
}
