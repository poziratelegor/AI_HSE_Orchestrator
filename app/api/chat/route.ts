import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest, getSupabaseServerClient } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { orchestrate } from "@/lib/orchestrator/router";

export async function POST(request: Request) {
  // 1. Auth check
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Input validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { message, conversationId } = body as Record<string, unknown>;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'message' обязательно и должно быть непустой строкой.");
  }

  if (conversationId !== undefined && typeof conversationId !== "string") {
    return ERRORS.INVALID_INPUT("Поле 'conversationId' должно быть строкой.");
  }

  // 3. Ensure conversation exists
  const supabase = getSupabaseServerClient();
  let convId = conversationId as string | undefined;

  if (!convId) {
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, channel: "web", title: (message as string).slice(0, 80) })
      .select("id")
      .single();

    if (convError || !conv) {
      console.error("[api/chat] conversation insert error:", convError);
      return ERRORS.INTERNAL("Не удалось создать диалог.");
    }
    convId = conv.id;
  }

  // 4. Save user message
  await supabase.from("messages").insert({
    conversation_id: convId,
    role: "user",
    content: message
  });

  // 5. Route through orchestrator
  try {
    const result = await orchestrate({
      text: (message as string).trim(),
      channel: "web",
      userId: user.id
    });

    // 6. Save assistant reply
    const replyText = (result as { result?: { summary?: string } }).result?.summary
      ?? (result as { summary?: string }).summary
      ?? JSON.stringify(result);

    await supabase.from("messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: replyText
    });

    return NextResponse.json({
      ok: true,
      conversationId: convId,
      reply: result
    });
  } catch (err) {
    console.error("[api/chat] orchestrate error:", err);
    return ERRORS.INTERNAL("Ошибка обработки сообщения.");
  }
}

