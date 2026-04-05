import Link from "next/link";
import {
  DashboardContainer,
  DataTableShell,
  EmptyState,
  FilterBar,
  PageHeader,
  StatCard,
  StatusBadge
} from "@/components/dashboard/ui";
import { getCurrentUserIdFromCookies } from "@/lib/supabase/queries/auth";
import { getUserTasks, type TaskFilter } from "@/lib/supabase/queries/tasks";

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "urgent", label: "Срочные" },
  { key: "in_progress", label: "В работе" },
  { key: "done", label: "Выполненные" }
];

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Срочно",
  high: "Высокий",
  medium: "Средний",
  low: "Низкий"
};

const PRIORITY_TONE: Record<string, "danger" | "warning" | "info" | "default"> = {
  urgent: "danger",
  high: "warning",
  medium: "info",
  low: "default"
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "В работе",
  done: "Выполнено",
  pending: "Запланировано"
};

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(dateString));
}

function resolveFilter(filter: string | undefined): TaskFilter {
  if (!filter) return "all";
  return FILTERS.some((item) => item.key === filter) ? (filter as TaskFilter) : "all";
}

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const params = await searchParams;
  const activeFilter = resolveFilter(params.filter);

  const userId = await getCurrentUserIdFromCookies();

  if (!userId) {
    return (
      <DashboardContainer>
        <PageHeader title="Задачи" subtitle="Контроль учебных задач, дедлайнов и приоритетов в едином рабочем пространстве." />
        <EmptyState
          title="Не удалось загрузить задачи"
          description="Выполните повторный вход, чтобы увидеть ваши задачи и дедлайны."
        />
      </DashboardContainer>
    );
  }

  const [allTasks, tasks] = await Promise.all([getUserTasks(userId, "all"), getUserTasks(userId, activeFilter)]);

  const totalCount = allTasks.length;
  const urgentCount = allTasks.filter((task) => task.priority === "urgent").length;
  const doneCount = allTasks.filter((task) => task.status === "done").length;

  return (
    <DashboardContainer>
      <PageHeader
        title="Задачи"
        subtitle="Контроль учебных задач, дедлайнов и приоритетов в едином рабочем пространстве."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Всего задач" value={String(totalCount)} hint="По всем статусам" />
        <StatCard label="Срочные" value={String(urgentCount)} hint="Приоритет urgent" />
        <StatCard label="Выполнено" value={String(doneCount)} hint="Статус done" />
      </section>

      <FilterBar>
        {FILTERS.map((filter) => {
          const href = filter.key === "all" ? "/dashboard/tasks" : `/dashboard/tasks?filter=${filter.key}`;
          const active = filter.key === activeFilter;

          return (
            <Link
              key={filter.key}
              href={href}
              className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-[#1B4F9D] bg-[#EAF1FB] text-[#003A8C]"
                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </FilterBar>

      {tasks.length === 0 ? (
        <EmptyState
          title="Задач пока нет"
          description="Попросите ассистента разбить цель на задачи — он сразу сформирует список с приоритетами и дедлайнами."
        />
      ) : (
        <DataTableShell
          headers={["Задача", "Описание", "Дедлайн", "Приоритет", "Статус"]}
          rows={tasks.map((task) => (
            <tr key={task.id}>
              <td className="px-4 py-3 text-sm font-medium text-slate-800">{task.title || "Без названия"}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{task.description || "—"}</td>
              <td className="px-4 py-3 text-sm text-slate-600">{formatDate(task.due_date)}</td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge
                  label={PRIORITY_LABEL[task.priority ?? ""] ?? "Не указан"}
                  tone={PRIORITY_TONE[task.priority ?? ""] ?? "default"}
                />
              </td>
              <td className="px-4 py-3 text-sm">
                <StatusBadge
                  label={STATUS_LABEL[task.status ?? ""] ?? "Новый"}
                  tone={task.status === "done" ? "success" : task.status === "in_progress" ? "warning" : "info"}
                />
              </td>
            </tr>
          ))}
        />
      )}
    </DashboardContainer>
  );
}
