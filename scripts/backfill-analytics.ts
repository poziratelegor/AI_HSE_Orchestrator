/**
 * Backfill для analytics_events и orchestrator_runs.
 *
 * Что делает:
 *   1. Ставит analytics_events.duration_ms = 0 там, где он NULL
 *      (для совместимости со старой схемой, чтобы avg() работал корректно).
 *   2. Заполняет orchestrator_runs.latency_ms = 0 там, где он NULL и status в
 *      ('completed', 'fallback', 'failed') — runs, которые точно завершились.
 *   3. Печатает сводку: сколько событий по типам за последние 7 дней,
 *      сколько orchestrator_runs по workflow и status.
 *
 * Идемпотентен: можно запускать многократно.
 *
 * Запуск:
 *   npx tsx scripts/backfill-analytics.ts
 *   DRY_RUN=1 npx tsx scripts/backfill-analytics.ts   # только сводка, без UPDATE
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.env.DRY_RUN === "1";

if (!url || !key) {
  console.error(
    "❌ Требуются: SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

async function backfillAnalyticsDuration() {
  console.log("\n🔧 analytics_events: duration_ms NULL → 0");

  const { count: nullCount } = await supabase
    .from("analytics_events")
    .select("id", { count: "exact", head: true })
    .is("duration_ms", null);

  console.log(`   Найдено NULL: ${nullCount ?? 0}`);

  if (dryRun || !nullCount || nullCount === 0) {
    return;
  }

  const { error } = await supabase
    .from("analytics_events")
    .update({ duration_ms: 0 })
    .is("duration_ms", null);

  if (error) {
    console.error(`   ❌ update failed: ${error.message}`);
  } else {
    console.log(`   ✅ обновлено ${nullCount} событий`);
  }
}

async function backfillRunLatency() {
  console.log("\n🔧 orchestrator_runs: latency_ms NULL → 0 (для completed/fallback/failed)");

  const { count: nullCount } = await supabase
    .from("orchestrator_runs")
    .select("id", { count: "exact", head: true })
    .is("latency_ms", null)
    .in("status", ["completed", "fallback", "failed"]);

  console.log(`   Найдено NULL: ${nullCount ?? 0}`);

  if (dryRun || !nullCount || nullCount === 0) {
    return;
  }

  const { error } = await supabase
    .from("orchestrator_runs")
    .update({ latency_ms: 0 })
    .is("latency_ms", null)
    .in("status", ["completed", "fallback", "failed"]);

  if (error) {
    console.error(`   ❌ update failed: ${error.message}`);
  } else {
    console.log(`   ✅ обновлено ${nullCount} runs`);
  }
}

async function summaryEvents() {
  console.log("\n📊 analytics_events за последние 7 дней:");

  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_name")
    .gte("created_at", SEVEN_DAYS_AGO);

  if (error) {
    console.error(`   ❌ ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    console.log("   (пусто)");
    return;
  }

  const counts = new Map<string, number>();
  for (const row of data as { event_name: string }[]) {
    counts.set(row.event_name, (counts.get(row.event_name) ?? 0) + 1);
  }

  for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${name.padEnd(30, " ")} ${count}`);
  }
  console.log(`   ${"ИТОГО".padEnd(30, " ")} ${data.length}`);
}

async function summaryRuns() {
  console.log("\n📊 orchestrator_runs за последние 7 дней:");

  const { data, error } = await supabase
    .from("orchestrator_runs")
    .select("status, selected_workflow, latency_ms")
    .gte("created_at", SEVEN_DAYS_AGO);

  if (error) {
    console.error(`   ❌ ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    console.log("   (пусто)");
    return;
  }

  const statusCounts = new Map<string, number>();
  const workflowCounts = new Map<string, number>();
  const latencies: number[] = [];

  for (const row of data as { status: string; selected_workflow: string | null; latency_ms: number | null }[]) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    const wf = row.selected_workflow ?? "(none)";
    workflowCounts.set(wf, (workflowCounts.get(wf) ?? 0) + 1);
    if (row.latency_ms !== null && row.latency_ms > 0) {
      latencies.push(row.latency_ms);
    }
  }

  console.log("   По status:");
  for (const [s, c] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${s.padEnd(20, " ")} ${c}`);
  }

  console.log("   По workflow:");
  for (const [w, c] of [...workflowCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${w.padEnd(20, " ")} ${c}`);
  }

  if (latencies.length > 0) {
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    console.log(`   Latency: avg=${avg}ms, p50=${p50}ms, p95=${p95}ms (n=${latencies.length})`);
  }

  console.log(`   Всего runs: ${data.length}`);
}

async function main() {
  console.log(`\n🔬 Analytics backfill ${dryRun ? "(DRY RUN — без UPDATE)" : ""}\n`);

  await backfillAnalyticsDuration();
  await backfillRunLatency();
  await summaryEvents();
  await summaryRuns();

  console.log("\n✅ Готово.\n");
}

main().catch((err) => {
  console.error("\n❌ Backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
