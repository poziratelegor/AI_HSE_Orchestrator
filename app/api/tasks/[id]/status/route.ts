import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { updateTaskStatus, type TaskStatus } from "@/lib/repository/tasks";

const VALID_STATUSES: TaskStatus[] = ["pending", "in_progress", "done"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. Auth
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  if (!id) {
    return ERRORS.INVALID_INPUT("Не указан ID задачи.");
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { status } = body as Record<string, unknown>;

  if (typeof status !== "string" || !VALID_STATUSES.includes(status as TaskStatus)) {
    return ERRORS.INVALID_INPUT(`Недопустимый статус. Допустимые: ${VALID_STATUSES.join(", ")}.`);
  }

  // 3. Update
  const result = await updateTaskStatus(id, user.id, status as TaskStatus);

  if (!result.ok) {
    console.error("[api/tasks/[id]/status] update failed:", result.error);
    return NextResponse.json(
      { ok: false, error: "update_failed", message: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
