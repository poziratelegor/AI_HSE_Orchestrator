import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { sendGeneratedLetter } from "@/lib/integrations/email";

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

  const { to, subject, body: letterBody, studentName } = body as Record<string, unknown>;

  if (!to || typeof to !== "string" || !to.includes("@")) {
    return ERRORS.INVALID_INPUT("Поле 'to' обязательно — укажи email получателя.");
  }

  if (!subject || typeof subject !== "string" || (subject as string).trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'subject' обязательно — укажи тему письма.");
  }

  if (!letterBody || typeof letterBody !== "string" || (letterBody as string).trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'body' обязательно — укажи текст письма.");
  }

  // 3. Send email
  try {
    const result = await sendGeneratedLetter({
      to: to as string,
      letterSubject: (subject as string).trim(),
      letterBody: (letterBody as string).trim(),
      studentName: typeof studentName === "string" ? studentName : undefined,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: "email_send_failed", message: result.error },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, emailId: result.id });
  } catch (err) {
    console.error("[api/email/send] error:", err);
    return ERRORS.INTERNAL("Не удалось отправить письмо.");
  }
}
