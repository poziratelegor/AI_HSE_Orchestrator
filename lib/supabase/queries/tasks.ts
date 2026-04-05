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
