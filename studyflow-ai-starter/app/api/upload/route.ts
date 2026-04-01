import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  return NextResponse.json({
    ok: true,
    feature: "upload",
    status: "processing",
    message:
      "Документ принят. Для продакшен-версии обработку чанкинга и embeddings лучше выполнять асинхронно через Vercel waitUntil, очередь или Supabase Edge Function.",
    received: body
  });
}
