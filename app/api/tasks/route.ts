import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { createTasks, normalizeNewTaskInput } from "@/lib/repository/tasks";

const MAX_BATCH = 500;

/**
 * POST /api/tasks
 * Создаёт одну или несколько задач для текущего пользователя.
 *
 * Body вариант 1 (одиночная задача):
 *   { title, description?, due_date?, priority?, status? }
 *
 * Body вариант 2 (батч, например при импорте Excel):
 *   { tasks: [ { title, ... }, ... ] }
 */
export async function POST(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело должно быть валидным JSON.");
  }

  // Поддерживаем оба формата
  let rawList: unknown[];
  if (body && typeof body === "object" && "tasks" in body && Array.isArray((body as { tasks?: unknown[] }).tasks)) {
    rawList = (body as { tasks: unknown[] }).tasks;
  } else {
    rawList = [body];
  }

  if (rawList.length === 0) return ERRORS.INVALID_INPUT("Список задач пуст.");
  if (rawList.length > MAX_BATCH) {
    return ERRORS.INVALID_INPUT(`Слишком много задач за раз (максимум ${MAX_BATCH}).`);
  }

  const normalized = [];
  const errors: { index: number; error: string }[] = [];

  for (let i = 0; i < rawList.length; i++) {
    const result = normalizeNewTaskInput(rawList[i]);
    if ("error" in result) {
      errors.push({ index: i, error: result.error });
    } else {
      normalized.push(result);
    }
  }

  if (errors.length > 0 && normalized.length === 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_input", message: "Все задачи невалидны.", errors },
      { status: 400 }
    );
  }

  const result = await createTasks(user.id, normalized);
  if (!result.ok) {
    console.error("[api/tasks POST] insert failed:", result.error);
    return NextResponse.json(
      { ok: false, error: "insert_failed", message: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    created: result.created,
    skipped: errors.length,
    errors: errors.length > 0 ? errors : undefined
  });
}
