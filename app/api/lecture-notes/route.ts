import { NextResponse } from "next/server";
import { generateLectureNotes } from "@/lib/services/content/lecture-notes";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

export async function POST(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Ожидается JSON.");
  }

  const { transcript } = body as Record<string, unknown>;
  if (
    !transcript ||
    typeof transcript !== "string" ||
    transcript.trim().length < 50
  ) {
    return ERRORS.INVALID_INPUT(
      "Поле 'transcript' обязательно (минимум 50 символов)."
    );
  }

  try {
    const data = await generateLectureNotes(transcript.trim(), user.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "generation_failed",
        message:
          err instanceof Error ? err.message : "Ошибка генерации конспекта.",
      },
      { status: 500 }
    );
  }
}
