import {
  DashboardContainer,
  EmptyState,
  FilterBar,
  FilterPill,
  PageHeader,
  StatCard
} from "@/components/dashboard/ui";
import { getCurrentUserIdFromCookies } from "@/lib/repository/auth";
import { getUserTasks, type TaskFilter } from "@/lib/repository/tasks";
import { TasksKanban } from "./TasksKanban";
import { TasksToolbar } from "./TasksToolbar";

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "urgent", label: "Срочные" },
  { key: "in_progress", label: "В работе" },
  { key: "done", label: "Выполненные" }
];

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

  const [allTasks, tasks] = await Promise.all([
    getUserTasks(userId, "all"),
    getUserTasks(userId, activeFilter)
  ]);

  const totalCount = allTasks.length;
  const urgentCount = allTasks.filter((task) => task.priority === "urgent").length;
  const doneCount = allTasks.filter((task) => task.status === "done").length;

  return (
    <DashboardContainer>
      <PageHeader
        title="Задачи"
        subtitle="Перетаскивай карточки между колонками — статус сохранится автоматически."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Всего задач" value={String(totalCount)} hint="По всем статусам" tone="info" />
        <StatCard label="Срочные" value={String(urgentCount)} hint="Приоритет urgent" tone="danger" />
        <StatCard label="Выполнено" value={String(doneCount)} hint="Статус done" tone="success" />
      </section>

      <TasksToolbar />

      <FilterBar>
        {FILTERS.map((filter) => {
          const href = filter.key === "all" ? "/dashboard/tasks" : `/dashboard/tasks?filter=${filter.key}`;
          return (
            <FilterPill
              key={filter.key}
              label={filter.label}
              href={href}
              active={filter.key === activeFilter}
            />
          );
        })}
      </FilterBar>

      {tasks.length === 0 ? (
        <EmptyState
          title="Задач пока нет"
          description="Попроси ассистента разбить цель на задачи — он сразу сформирует список с приоритетами и дедлайнами."
        />
      ) : (
        <TasksKanban initialTasks={tasks} />
      )}
    </DashboardContainer>
  );
}
