export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import {
  DashboardContainer,
  DataTableShell,
  EmptyState,
  InlineAlert,
  PageHeader,
  SectionCard,
  StatCard
} from "@/components/dashboard/ui";
import {
  formatMetricValue,
  getOverviewMetrics,
  getScenarioBreakdown,
  getFunnelData
} from "@/lib/analytics/metrics";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const insights = [
  "Сценарии официальной переписки остаются основным драйвером использования.",
  "Запросы на анализ документов растут после загрузки методических материалов.",
  "Утренний интервал 09:00–12:00 показывает максимальную активность."
];

export default async function AnalyticsPage() {
  // ── Проверка доступа ──────────────────────────────────────────────────
  const supabase = getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") {
    return (
      <DashboardContainer>
        <PageHeader title="Аналитика" subtitle="" />
        <SectionCard title="Доступ ограничен" subtitle="">
          <p className="text-sm text-[var(--hse-text-muted)]">
            Дашборд аналитики доступен только команде проекта.
            Обратитесь к администратору для получения доступа.
          </p>
        </SectionCard>
      </DashboardContainer>
    );
  }

  // ── Загрузка данных ───────────────────────────────────────────────────
  let metrics: Awaited<ReturnType<typeof getOverviewMetrics>> | null = null;
  let scenarios: Awaited<ReturnType<typeof getScenarioBreakdown>> | null = null;
  let funnel: Awaited<ReturnType<typeof getFunnelData>> | null = null;
  let loadError: string | null = null;

  try {
    [metrics, scenarios, funnel] = await Promise.all([
      getOverviewMetrics(),
      getScenarioBreakdown(),
      getFunnelData()
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Не удалось загрузить аналитику.";
  }

  const hasData = metrics && metrics.totalRequests7d > 0;

  return (
    <DashboardContainer>
      <PageHeader
        title="Аналитика"
        subtitle="Использование ключевых сценариев StudyFlow AI за последние 7 дней."
      />

      {loadError && <div className="mb-4"><InlineAlert message={loadError} tone="danger" /></div>}

      {!hasData && !loadError && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M6 4v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Пока нет данных — метрики появятся после первых запросов к ассистенту
        </div>
      )}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard
          label="Активные пользователи"
          value={formatMetricValue(metrics?.activeUsers7d ?? 0)}
          hint="За 7 дней"
          tone="info"
        />
        <StatCard
          label="Всего запросов"
          value={formatMetricValue(metrics?.totalRequests7d ?? 0)}
          hint="За 7 дней"
          tone="success"
        />
        <StatCard
          label="Среднее время ответа"
          value={metrics?.avgLatencyMs ? `${(metrics.avgLatencyMs / 1000).toFixed(1)} сек` : "—"}
          hint="Латентность оркестратора"
          tone="warning"
        />
        <StatCard
          label="Доля успешных"
          value={metrics?.successRate !== null && metrics?.successRate !== undefined ? `${metrics.successRate}%` : "—"}
          hint="Завершённые workflow"
          tone="success"
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Контейнер под график активности" subtitle="Место для будущего line/bar chart.">
            <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-[var(--hse-border)] bg-[var(--hse-page-bg)]">
              <p className="text-xs text-slate-400">График появится при подключении chart-библиотеки</p>
            </div>
          </SectionCard>

          <SectionCard title="Распределение по сценариям" subtitle="Какие workflow используются чаще всего.">
            {scenarios && scenarios.length > 0 ? (
              <DataTableShell
                headers={["Сценарий", "Запросы", "Доля"]}
                rows={scenarios.map(row => (
                  <tr key={row.scenario} className="transition-colors hover:bg-[var(--hse-light)]/20">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.scenario}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{formatMetricValue(row.requests)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{row.share}</td>
                  </tr>
                ))}
              />
            ) : (
              <EmptyState
                title="Нет данных о сценариях"
                description="Используйте ассистента — здесь появится статистика по workflow."
              />
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Воронка" subtitle="Конверсия запросов за 7 дней.">
            {funnel && funnel.length > 0 && funnel[0].count > 0 ? (
              <div className="space-y-2">
                {funnel.map((step, i) => {
                  const maxCount = funnel![0].count || 1;
                  const widthPercent = Math.max(40, Math.round((step.count / maxCount) * 100));
                  const colors = ["bg-[var(--hse-blue)]", "bg-[var(--hse-blue-mid)]", "bg-[var(--hse-accent)]"];

                  return (
                    <div
                      key={step.label}
                      className={`rounded-lg ${colors[i] ?? "bg-[var(--hse-accent)]"} px-3 py-2 text-xs text-white transition-all`}
                      style={{ width: `${widthPercent}%` }}
                    >
                      {step.label}: {formatMetricValue(step.count)}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center text-xs text-slate-400">
                Нет данных для воронки
              </div>
            )}
          </SectionCard>

          <SectionCard title="Наблюдения" subtitle="Аналитические заметки.">
            <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
              {insights.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </DashboardContainer>
  );
}
