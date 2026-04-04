import {
  DashboardContainer,
  DataTableShell,
  PageHeader,
  SectionCard,
  StatCard
} from "@/components/dashboard/ui";

const scenarioRows = [
  { scenario: "Генерация писем", requests: "86", share: "41%" },
  { scenario: "Анализ документов", requests: "64", share: "31%" },
  { scenario: "Планирование задач", requests: "58", share: "28%" }
];

const insights = [
  "Сценарии официальной переписки остаются основным драйвером использования.",
  "Запросы на анализ документов растут после загрузки методических материалов.",
  "Утренний интервал 09:00–12:00 показывает максимальную активность."
];

export default function AnalyticsPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Аналитика"
        subtitle="Статический экран продуктовой аналитики для оценки использования ключевых сценариев StudyFlow AI."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Активные пользователи" value="142" hint="За 7 дней" />
        <StatCard label="Всего запросов" value="208" hint="+9% к прошлому периоду" />
        <StatCard label="Среднее время ответа" value="12 сек" hint="Mock значение" />
        <StatCard label="Доля успешных сценариев" value="94%" hint="Валидный результат" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Контейнер под график активности" subtitle="Место для будущего line/bar chart.">
            <div className="h-52 rounded-xl border border-dashed border-slate-300 bg-slate-50" />
          </SectionCard>

          <SectionCard title="Usage breakdown по сценариям" subtitle="Таблица распределения запросов.">
            <DataTableShell
              headers={["Сценарий", "Запросы", "Доля"]}
              rows={scenarioRows.map(row => (
                <tr key={row.scenario}>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.scenario}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.requests}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{row.share}</td>
                </tr>
              ))}
            />
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Funnel" subtitle="Условная воронка сценариев.">
            <div className="space-y-2">
              <div className="rounded-lg bg-[#003A8C] px-3 py-2 text-xs text-white">Просмотры: 420</div>
              <div className="w-11/12 rounded-lg bg-[#1D4E9E] px-3 py-2 text-xs text-white">Запуски: 260</div>
              <div className="w-9/12 rounded-lg bg-[#3665AF] px-3 py-2 text-xs text-white">Завершения: 208</div>
            </div>
          </SectionCard>

          <SectionCard title="Notes / Insights" subtitle="Короткие аналитические наблюдения.">
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
