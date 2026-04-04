import {
  ActionButton,
  DashboardContainer,
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge
} from "@/components/dashboard/ui";

const quickScenarios = ["Подготовить официальное письмо", "Суммаризировать документ", "Составить учебный план", "Разбить цель на задачи"];

const examples = [
  "Составь вежливое письмо преподавателю о консультации на следующей неделе.",
  "Выдели ключевые тезисы из методички по статистике.",
  "Собери план подготовки к экзамену за 10 дней."
];

const recentPrompts = [
  { text: "Подготовь ответ в учебный офис по академической справке", status: "Готово" },
  { text: "Сделай список задач из загруженного syllabus", status: "В обработке" },
  { text: "Сократи письмо для куратора до делового формата", status: "Готово" }
];

export default function AssistantPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Ассистент"
        subtitle="Центральный интерфейс для запуска AI-сценариев. Экран подготовлен к подключению backend-обработки."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Новый запрос" subtitle="Сформулируйте задачу в свободной форме.">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <textarea
                className="h-32 w-full resize-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                placeholder="Например: помоги подготовить письмо о переносе дедлайна с формальным тоном и краткой аргументацией."
              />
              <div className="mt-3 flex justify-end">
                <ActionButton label="Сгенерировать" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {quickScenarios.map(item => (
                <ActionButton key={item} label={item} secondary />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Примеры запросов" subtitle="Подсказки для быстрого старта.">
            <ul className="space-y-3">
              {examples.map(example => (
                <li key={example} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  {example}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Как это работает" subtitle="Базовый процесс обработки запроса.">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
              <li>Система классифицирует сценарий и определяет тип задачи.</li>
              <li>Выбирается подходящий workflow с учетом контекста документов.</li>
              <li>Формируется ответ в академичном и формальном стиле.</li>
            </ol>
          </SectionCard>
        </div>

        <SectionCard title="Недавние запросы" subtitle="Mock-история для будущей ленты активности.">
          <div className="space-y-3">
            {recentPrompts.map(item => (
              <div key={item.text} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm text-slate-800">{item.text}</p>
                <div className="mt-2">
                  <StatusBadge label={item.status} tone={item.status === "Готово" ? "success" : "warning"} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <EmptyState title="История ограничена" description="После подключения backend здесь появится полный журнал запросов и результатов." />
          </div>
        </SectionCard>
      </div>
    </DashboardContainer>
  );
}
