import Link from "next/link";
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

const popular = [
  { label: "Письмо о переносе дедлайна", count: 34 },
  { label: "Конспект по длинному PDF", count: 27 },
  { label: "План подготовки к экзамену", count: 19 }
];

const features = [
  "Генерировать формальные письма по шаблонам",
  "Извлекать тезисы и задачи из документов",
  "Отслеживать учебные дедлайны и приоритеты"
];

const STAT_DELAYS = ["0ms", "80ms", "160ms", "240ms"];

export default function DashboardPage() {
  return (
    <DashboardContainer>
      <div className="animate-fade-in">
        <PageHeader
          title="Обзор"
          subtitle="Рабочая панель для учебных задач: документы, письма, поручения и AI-сценарии."
          action={{ label: "Открыть ассистента", href: "/dashboard/assistant" }}
        />
      </div>

      {/* Stats — staggered slide-up */}
      <section className="mb-6 grid gap-4 md:grid-cols-4" aria-label="Статистика">
        {[
          { label: "Запросов за неделю", value: "128", hint: "+14% к прошлой неделе", tone: "info" as const },
          { label: "Документов в базе", value: "36", hint: "5 новых сегодня", tone: "success" as const },
          { label: "Черновиков писем", value: "12", hint: "3 требуют проверки", tone: "warning" as const },
          { label: "Активных задач", value: "9", hint: "2 с дедлайном сегодня", tone: "danger" as const }
        ].map((stat, i) => (
          <div key={stat.label} className="animate-slide-up" style={{ animationDelay: STAT_DELAYS[i] }}>
            <StatCard {...stat} />
          </div>
        ))}
      </section>

      {/* Quick actions + info */}
      <section className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="animate-slide-up delay-200">
          <SectionCard title="Быстрые действия" subtitle="Наиболее частые рабочие сценарии.">
            <div className="flex flex-wrap gap-2">
              <ActionButton label="Новый запрос" href="/dashboard/assistant" />
              <ActionButton label="Загрузить файл" href="/dashboard/documents" secondary />
              <ActionButton label="Создать письмо" href="/dashboard/letters" secondary />
            </div>
          </SectionCard>
        </div>

        <div className="animate-slide-up delay-300">
          <SectionCard title="Популярные сценарии" subtitle="Что чаще всего используют студенты.">
            <ul className="space-y-2.5">
              {popular.map((item, i) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between text-sm animate-fade-in"
                  style={{ animationDelay: `${300 + i * 60}ms` }}
                >
                  <span className="text-slate-700">{item.label}</span>
                  <span className="rounded-full bg-[var(--hse-light)] px-2 py-0.5 text-xs font-medium text-[var(--hse-blue)]">{item.count}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="animate-slide-up delay-400">
          <SectionCard title="Возможности" subtitle="Ключевые функции в одном месте.">
            <ul className="space-y-2">
              {features.map((f, i) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-slate-700 animate-fade-in"
                  style={{ animationDelay: `${400 + i * 60}ms` }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--hse-blue)]">
                    <circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.12" />
                    <path d="m4 7 2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </section>

      {/* Recent activity */}
      <div className="animate-slide-up delay-500">
        <SectionCard title="Последние действия" subtitle="Хронология недавней активности.">
          <div className="space-y-3">
            {recentActions.map((action, i) => (
              <article
                key={action.title}
                className="flex flex-col gap-2 rounded-xl border border-[var(--hse-border)] px-4 py-3 transition-all duration-200 hover:border-[var(--hse-blue)]/20 hover:bg-[var(--hse-light)]/20 hover:-translate-y-px hover:shadow-sm md:flex-row md:items-center md:justify-between animate-fade-in"
                style={{ animationDelay: `${500 + i * 60}ms` }}
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{action.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{action.time}</p>
                </div>
                <StatusBadge
                  label={action.status}
                  tone={action.status === "Готово" ? "success" : "warning"}
                />
              </article>
            ))}
          </div>

          <p className="mt-4 text-center text-xs text-slate-400">
            После подключения backend здесь появится живая история запросов.{" "}
            <Link href="/dashboard/assistant" className="text-[var(--hse-blue)] underline-offset-2 hover:underline">
              Сделать первый запрос →
            </Link>
          </p>
        </SectionCard>
      </div>
    </DashboardContainer>
  );
}
