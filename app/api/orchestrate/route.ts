import { NextResponse } from "next/server";
import { orchestrate } from "@/lib/orchestrator/router";

export async function POST(request: Request) {
  const body = await request.json();
  const result = await orchestrate({
    text: body.text ?? "",
    channel: body.channel ?? "web",
    attachments: body.attachments ?? []
  });

  return NextResponse.json(result);
}
