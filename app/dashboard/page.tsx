import Link from "next/link";
import {
  ActionButton,
  DashboardContainer,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge
} from "@/components/dashboard/ui";
import { getCurrentUserIdFromCookies } from "@/lib/repository/auth";
import { getUserDocuments } from "@/lib/repository/documents";
import { getUserTasks } from "@/lib/repository/tasks";
import { getUserLetters } from "@/lib/repository/letters";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const STAT_DELAYS = ["0ms", "80ms", "160ms", "240ms"];

const features = [
  "Генерировать формальные письма по шаблонам",
  "Извлекать тезисы и задачи из документов",
  "Отслеживать учебные дедлайны и приоритеты"
];

async function getRecentEventsCount(userId: string): Promise<number> {
  try {
    const supabase = getSupabaseServerClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("analytics_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgo);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function DashboardPage() {
  const userId = await getCurrentUserIdFromCookies();

  if (!userId) {
    return (
      <DashboardContainer>
        <PageHeader
          title="Обзор"
          subtitle="Выполните вход, чтобы увидеть рабочую панель."
        />
        <EmptyState
          title="Сессия истекла"
          description="Войдите снова, чтобы загрузить статистику."
          action={<ActionButton label="Войти" href="/login" />}
        />
      </DashboardContainer>
    );
  }

  const [docs, tasks, letters, eventsCount] = await Promise.all([
    getUserDocuments(userId),
    getUserTasks(userId, "all"),
    getUserLetters(userId),
    getRecentEventsCount(userId)
  ]);

  const docsReady = docs.filter((d) => d.processing_status === "ready").length;
  const tasksPending = tasks.filter((t) => t.status === "pending" || !t.status).length;
  const tasksUrgent = tasks.filter((t) => t.priority === "urgent").length;
  const lettersCount = letters.length;

  const isFresh = docs.length === 0 && tasks.length === 0 && letters.length === 0;

  const stats = [
    { label: "Документов", value: String(docs.length), hint: `${docsReady} обработано`, tone: "info" as const },
    { label: "Задач", value: String(tasks.length), hint: `${tasksPending} к выполнению`, tone: "success" as const },
    { label: "Писем", value: String(lettersCount), hint: lettersCount > 0 ? "Сгенерировано" : "Пока нет", tone: "warning" as const },
    { label: "Срочных задач", value: String(tasksUrgent), hint: "Приоритет urgent", tone: "danger" as const }
  ];

  const recentTasks = tasks.slice(0, 3);

  return (
    <DashboardContainer>
      <div className="animate-fade-in">
        <PageHeader
          title="Обзор"
          subtitle="Рабочая панель для учебных задач: документы, письма, поручения и AI-сценарии."
          action={{ label: "Открыть ассистента", href: "/dashboard/assistant" }}
        />
      </div>

      {isFresh ? (
        <div className="animate-fade-in">
          <EmptyState
            title="Начни работу с ассистентом"
            description="У тебя пока нет документов, задач и писем. Загрузи первый документ — и ассистент сможет отвечать на вопросы по нему."
            action={<ActionButton label="Загрузить первый документ" href="/dashboard/documents" />}
          />
        </div>
      ) : (
        <>
          <section className="mb-6 grid gap-4 md:grid-cols-4" aria-label="Статистика">
            {stats.map((stat, i) => (
              <div key={stat.label} className="animate-slide-up" style={{ animationDelay: STAT_DELAYS[i] }}>
                <StatCard {...stat} />
              </div>
            ))}
          </section>

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
              <SectionCard title="Активность за неделю" subtitle="События за последние 7 дней.">
                <p className="text-3xl font-bold text-[var(--hse-blue)]">{eventsCount}</p>
                <p className="mt-1 text-xs text-[var(--hse-text-muted)]">обработанных запросов</p>
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

          <div className="animate-slide-up delay-500">
            <SectionCard title="Ближайшие задачи" subtitle={tasks.length > 0 ? `Показано ${recentTasks.length} из ${tasks.length}` : "Нет задач"}>
              {recentTasks.length === 0 ? (
                <p className="text-sm text-[var(--hse-text-muted)]">Задач пока нет. Попроси ассистента разбить цель на задачи.</p>
              ) : (
                <div className="space-y-3">
                  {recentTasks.map((task, i) => (
                    <article
                      key={task.id}
                      className="flex flex-col gap-2 rounded-xl border border-[var(--hse-border)] px-4 py-3 transition-all duration-200 hover:border-[var(--hse-blue)]/20 hover:bg-[var(--hse-light)]/20 hover:-translate-y-px hover:shadow-sm md:flex-row md:items-center md:justify-between animate-fade-in"
                      style={{ animationDelay: `${500 + i * 60}ms` }}
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{task.title || "Без названия"}</p>
                        {task.due_date && (
                          <p className="mt-0.5 text-xs text-slate-500">До {new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(task.due_date))}</p>
                        )}
                      </div>
                      <StatusBadge
                        label={task.status === "done" ? "Выполнено" : task.status === "in_progress" ? "В работе" : "Запланировано"}
                        tone={task.status === "done" ? "success" : task.status === "in_progress" ? "warning" : "info"}
                      />
                    </article>
                  ))}
                </div>
              )}
              <p className="mt-4 text-center text-xs text-slate-400">
                <Link href="/dashboard/tasks" className="text-[var(--hse-blue)] underline-offset-2 hover:underline">
                  Все задачи →
                </Link>
              </p>
            </SectionCard>
          </div>
        </>
      )}
    </DashboardContainer>
  );
}
