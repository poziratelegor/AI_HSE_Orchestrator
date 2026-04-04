import {
  ActionButton,
  DashboardContainer,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge
} from "@/components/dashboard/ui";

const recentActions = [
  { title: "Сформирован черновик письма в учебный офис", time: "Сегодня, 11:20", status: "Готово" },
  { title: "Обработан PDF с требованиями к курсовой", time: "Сегодня, 09:45", status: "В обработке" },
  { title: "Собран список задач по дисциплине Data Analysis", time: "Вчера, 18:10", status: "Готово" }
];

export default function DashboardPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Обзор"
        subtitle="Единая рабочая панель для учебных задач: документы, официальные письма, поручения и аналитика использования AI-сценариев."
        action={{ label: "Открыть ассистента", href: "/dashboard/assistant" }}
      />

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label="Запросов за неделю" value="128" hint="+14% к прошлой неделе" />
        <StatCard label="Документов в базе" value="36" hint="5 новых сегодня" />
        <StatCard label="Черновиков писем" value="12" hint="3 требуют проверки" />
        <StatCard label="Активных задач" value="9" hint="2 с дедлайном сегодня" />
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-3">
        <SectionCard title="Быстрые действия" subtitle="Наиболее частые рабочие сценарии.">
          <div className="flex flex-wrap gap-2">
            <ActionButton label="Новый запрос" href="/dashboard/assistant" />
            <ActionButton label="Загрузить файл" href="/dashboard/documents" secondary />
            <ActionButton label="Создать письмо" href="/dashboard/letters" secondary />
          </div>
        </SectionCard>

        <SectionCard title="Популярные сценарии" subtitle="Что чаще всего используют студенты и кураторы.">
          <ul className="space-y-3 text-sm text-slate-700">
            <li className="flex items-center justify-between"><span>Письмо о переносе дедлайна</span><span>34</span></li>
            <li className="flex items-center justify-between"><span>Конспект по длинному PDF</span><span>27</span></li>
            <li className="flex items-center justify-between"><span>План подготовки к экзамену</span><span>19</span></li>
          </ul>
        </SectionCard>

        <SectionCard title="Что можно сделать" subtitle="Ключевые функции системы в одном месте.">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Генерировать формальные письма по шаблонам.</li>
            <li>Извлекать тезисы и задачи из документов.</li>
            <li>Отслеживать учебные дедлайны и приоритеты.</li>
          </ul>
        </SectionCard>
      </section>

      <SectionCard title="Последние действия" subtitle="Хронология недавней активности.">
        <div className="space-y-3">
          {recentActions.map(action => (
            <article key={action.title} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900">{action.title}</p>
                <p className="text-xs text-slate-500">{action.time}</p>
              </div>
              <StatusBadge label={action.status} tone={action.status === "Готово" ? "success" : "warning"} />
            </article>
          ))}
        </div>
      </SectionCard>
    </DashboardContainer>
  );
}
