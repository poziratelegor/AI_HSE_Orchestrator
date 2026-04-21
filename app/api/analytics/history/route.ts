import { NextResponse } from "next/server";
import { ERRORS } from "@/lib/api/helpers";
import { getSupabaseRouteClient, getSupabaseUserFromRequest } from "@/lib/supabase/server";

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

type AnalyticsHistoryRow = {
  id: string;
  event_name: string;
  created_at: string;
  meta?: { queryPreview?: string } | null;
};

function mapStatus(eventName: string): "Готово" | "Ошибка" | "В обработке" {
  if (eventName === "orchestrate_error") return "Ошибка";
  if (eventName === "orchestrate_success" || eventName === "orchestrate_fallback") return "Готово";
  return "В обработке";
}

export async function GET(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  const { searchParams } = new URL(request.url);
  const rawLimit = Number.parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const supabase = await getSupabaseRouteClient();
    const { data, error } = await supabase
      .from("analytics_events")
      .select("id,event_name,created_at,meta")
      .eq("user_id", user.id)
      .in("event_name", ["orchestrate_success", "orchestrate_fallback", "orchestrate_error"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: "analytics_temporarily_unavailable",
          message: "Временная ошибка чтения аналитики. Попробуйте обновить страницу через несколько секунд.",
          items: []
        },
        { status: 503 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "События пока не найдены.",
        items: []
      });
    }

    const items = (data as AnalyticsHistoryRow[]).map((row) => ({
      id: row.id,
      text: row.meta?.queryPreview?.trim() || "Запрос без текста",
      status: mapStatus(row.event_name),
      createdAt: row.created_at
    }));

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "analytics_temporarily_unavailable",
        message: "Временная ошибка чтения аналитики. Попробуйте обновить страницу через несколько секунд.",
        items: []
      },
      { status: 503 }
    );
  }
}
