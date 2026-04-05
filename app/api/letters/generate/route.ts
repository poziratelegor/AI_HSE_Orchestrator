import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { runLetterGenerator } from "@/lib/services/letters";
import { trackEvent } from "@/lib/analytics/events";
import { ANALYTICS_EVENTS } from "@/lib/constants/analytics";

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

  const { text } = body as Record<string, unknown>;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'text' обязательно — опиши суть письма.");
  }

  const result = await runLetterGenerator(text.trim());

  if (result.ok) {
    void trackEvent(ANALYTICS_EVENTS.LETTER_GENERATED, {
      userId: user.id,
      workflow: result.workflow,
      channel: "web",
      meta: {
        subject: result.data.subject,
        generated: true
      }
    });

    return NextResponse.json(result);
  }

  return ERRORS.INTERNAL(result.message);
}
