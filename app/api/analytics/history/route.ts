import { NextResponse } from "next/server";
import { ERRORS } from "@/lib/api/helpers";
import { getSupabaseUserFromRequest, getSupabaseServerClient } from "@/lib/supabase/server";

type RunRow = {
  input_text: string | null;
  status: string | null;
  selected_workflow: string | null;
  created_at: string | null;
};

function mapStatus(status: string | null): "Готово" | "Ошибка" | "Уточнение" | "Маршрут" {
  if (status === "completed") return "Готово";
  if (status === "failed") return "Ошибка";
  if (status === "clarification") return "Уточнение";
  return "Маршрут";
}

export async function GET(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? 6);
  const limit = Number.isFinite(rawLimit) ? Math.min(20, Math.max(1, Math.floor(rawLimit))) : 6;

  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .from("orchestrator_runs")
      .select("input_text, status, selected_workflow, created_at")
      .eq("user_id", user.id)
      .eq("channel", "web")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return ERRORS.INTERNAL("Не удалось загрузить историю запросов.");

    const items = ((data ?? []) as RunRow[])
      .filter((row) => typeof row.input_text === "string" && row.input_text.trim().length > 0)
      .map((row) => ({
        text: (row.input_text ?? "").trim(),
        status: mapStatus(row.status),
        workflow: row.selected_workflow,
        createdAt: row.created_at ?? undefined
      }));

    return NextResponse.json({ ok: true, items });
  } catch {
    return ERRORS.INTERNAL("Не удалось загрузить историю запросов.");
  }
}
