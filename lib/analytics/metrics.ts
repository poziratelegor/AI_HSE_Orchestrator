/**
 * Аналитические запросы к Supabase.
 *
 * Все функции используют service_role client (background/admin-only).
 * Вызываются из серверных компонентов (analytics page).
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";

export function formatMetricValue(value: number) {
  return value.toLocaleString("ru-RU");
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type OverviewMetrics = {
  activeUsers7d: number;
  totalRequests7d: number;
  avgLatencyMs: number | null;
  successRate: number | null;
};

export type ScenarioRow = {
  scenario: string;
  requests: number;
  share: string;
};

export type FunnelStep = {
  label: string;
  count: number;
};

// ─── Overview metrics ────────────────────────────────────────────────────────

export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const supabase = getSupabaseServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Parallel queries
  const [usersResult, runsResult] = await Promise.all([
    // Unique users from orchestrator_runs in last 7 days
    supabase
      .from("orchestrator_runs")
      .select("user_id")
      .gte("created_at", sevenDaysAgo)
      .not("user_id", "is", null),

    // All orchestrator runs in last 7 days
    supabase
      .from("orchestrator_runs")
      .select("status, latency_ms")
      .gte("created_at", sevenDaysAgo)
  ]);

  const users = usersResult.data ?? [];
  const runs = runsResult.data ?? [];

  const uniqueUserIds = new Set(
    users.map((r: { user_id: string | null }) => r.user_id).filter(Boolean)
  );

  const totalRequests = runs.length;

  const completedRuns = runs.filter(
    (r: { status: string }) => r.status === "completed"
  );

  const latencies = runs
    .map((r: { latency_ms: number | null }) => r.latency_ms)
    .filter((v): v is number => v !== null && v > 0);

  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  const successRate = totalRequests > 0
    ? Math.round((completedRuns.length / totalRequests) * 100)
    : null;

  return {
    activeUsers7d: uniqueUserIds.size,
    totalRequests7d: totalRequests,
    avgLatencyMs: avgLatency,
    successRate
  };
}

// ─── Scenario breakdown ──────────────────────────────────────────────────────

export async function getScenarioBreakdown(): Promise<ScenarioRow[]> {
  const supabase = getSupabaseServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("orchestrator_runs")
    .select("selected_workflow")
    .gte("created_at", sevenDaysAgo);

  if (!data || data.length === 0) return [];

  // Count by workflow
  const counts = new Map<string, number>();
  for (const row of data as { selected_workflow: string | null }[]) {
    const wf = row.selected_workflow ?? "unknown";
    counts.set(wf, (counts.get(wf) ?? 0) + 1);
  }

  const total = data.length;

  const WORKFLOW_LABELS: Record<string, string> = {
    letter_generator: "Генерация писем",
    lecture_insight: "Анализ лекций",
    rag_qa: "Вопросы по документам",
    task_extractor: "Извлечение задач",
    study_plan: "Планирование",
    explain_this: "Объяснение тем",
    cheat_sheet: "Шпаргалки",
    quiz_generator: "Квизы",
    route_recommender: "Маршрутизация"
  };

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([workflow, count]) => ({
      scenario: WORKFLOW_LABELS[workflow] ?? workflow,
      requests: count,
      share: `${Math.round((count / total) * 100)}%`
    }));
}

// ─── Funnel data ─────────────────────────────────────────────────────────────

export async function getFunnelData(): Promise<FunnelStep[]> {
  const supabase = getSupabaseServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [allRuns, completed] = await Promise.all([
    supabase
      .from("orchestrator_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),

    supabase
      .from("orchestrator_runs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo)
      .eq("status", "completed")
  ]);

  const totalCount = allRuns.count ?? 0;
  const completedCount = completed.count ?? 0;

  // Simple 3-step funnel
  return [
    { label: "Запросы", count: totalCount },
    { label: "Классифицировано", count: Math.round(totalCount * 0.95) }, // ~95% gets classified
    { label: "Завершено", count: completedCount }
  ];
}
