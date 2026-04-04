import {
  DashboardContainer,
  DataTableShell,
  EmptyState,
  FilterBar,
  FilterPill,
  PageHeader,
  StatCard,
  StatusBadge
} from "@/components/dashboard/ui";

const tasks = [
  { name: "Подготовить черновик письма преподавателю", deadline: "04.04.2026", priority: "Срочно", status: "В работе" },
  { name: "Проверить конспект по Data Analysis", deadline: "05.04.2026", priority: "Средний", status: "Запланировано" },
  { name: "Собрать вопросы к семинару", deadline: "07.04.2026", priority: "Низкий", status: "Выполнено" }
];

export default function TasksPage() {
  return (
    <DashboardContainer>
      <PageHeader
        title="Задачи"
        subtitle="Контроль учебных задач, дедлайнов и приоритетов в едином рабочем пространстве."
      />

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Всего задач" value="24" hint="На текущую неделю" />
        <StatCard label="Срочные" value="5" hint="Дедлайн до 24 часов" />
        <StatCard label="Выполнено" value="14" hint="58% прогресса" />
      </section>

      <FilterBar>
        <FilterPill label="Все" active />
        <FilterPill label="Срочные" />
        <FilterPill label="В работе" />
        <FilterPill label="Выполненные" />
      </FilterBar>

      <DataTableShell
        headers={["Задача", "Дедлайн", "Приоритет", "Статус"]}
        rows={tasks.map(task => (
          <tr key={task.name}>
            <td className="px-4 py-3 text-sm font-medium text-slate-800">{task.name}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{task.deadline}</td>
            <td className="px-4 py-3 text-sm text-slate-600">{task.priority}</td>
            <td className="px-4 py-3 text-sm">
              <StatusBadge
                label={task.status}
                tone={task.status === "Выполнено" ? "success" : task.status === "В работе" ? "warning" : "info"}
              />
            </td>
          </tr>
        ))}
      />

      <div className="mt-6">
        <EmptyState title="Пустой список задач" description="Если задач нет, этот блок станет основным состоянием экрана с предложением создать первую задачу." />
      </div>
    </DashboardContainer>
  );
}
