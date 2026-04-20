import { getSupabaseServerClient } from "@/lib/supabase/server";

export type TaskFilter = "all" | "urgent" | "in_progress" | "done";

export type TaskRow = {
  id: string;
  title: string | null;
  description: string | null;
  due_date: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
};

export async function getUserTasks(userId: string, filter: TaskFilter = "all"): Promise<TaskRow[]> {
  const supabase = getSupabaseServerClient();

  let query = supabase
    .from("tasks")
    .select("id, title, description, due_date, status, priority, created_at")
    .eq("user_id", userId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filter === "urgent") {
    query = query.eq("priority", "urgent");
  }

  if (filter === "in_progress") {
    query = query.eq("status", "in_progress");
  }

  if (filter === "done") {
    query = query.eq("status", "done");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load tasks: ${error.message}`);
  }

  return (data ?? []) as TaskRow[];
}

export type TaskStatus = "pending" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

const VALID_STATUSES: ReadonlySet<TaskStatus> = new Set(["pending", "in_progress", "done"]);
const VALID_PRIORITIES: ReadonlySet<TaskPriority> = new Set(["low", "medium", "high", "urgent"]);

export type NewTaskInput = {
  title: string;
  description?: string | null;
  due_date?: string | null; // ISO-8601
  priority?: TaskPriority;
  status?: TaskStatus;
};

export function normalizeNewTaskInput(raw: unknown): NewTaskInput | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Ожидался объект задачи." };
  const r = raw as Record<string, unknown>;

  const title = typeof r.title === "string" ? r.title.trim() : "";
  if (!title) return { error: "Поле title обязательно." };
  if (title.length > 500) return { error: "title слишком длинный (макс 500 символов)." };

  const description =
    typeof r.description === "string" && r.description.trim() ? r.description.trim() : null;

  let due_date: string | null = null;
  if (r.due_date != null && r.due_date !== "") {
    const s = String(r.due_date);
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return { error: `Неверный формат даты: "${s}".` };
    due_date = d.toISOString();
  }

  const priority =
    typeof r.priority === "string" && VALID_PRIORITIES.has(r.priority as TaskPriority)
      ? (r.priority as TaskPriority)
      : "medium";

  const status =
    typeof r.status === "string" && VALID_STATUSES.has(r.status as TaskStatus)
      ? (r.status as TaskStatus)
      : "pending";

  return { title, description, due_date, priority, status };
}

export async function createTasks(
  userId: string,
  inputs: NewTaskInput[]
): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  if (inputs.length === 0) return { ok: true, created: 0 };

  const supabase = getSupabaseServerClient();
  const rows = inputs.map((t) => ({
    user_id: userId,
    title: t.title,
    description: t.description ?? null,
    due_date: t.due_date ?? null,
    priority: t.priority ?? "medium",
    status: t.status ?? "pending"
  }));

  const { error, count } = await supabase
    .from("tasks")
    .insert(rows, { count: "exact" });

  if (error) return { ok: false, error: error.message };
  return { ok: true, created: count ?? rows.length };
}

export async function updateTaskStatus(
  taskId: string,
  userId: string,
  status: TaskStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseServerClient();

  const { error } = await supabase
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
