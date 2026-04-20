"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StatusBadge } from "@/components/dashboard/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { TaskRow } from "@/lib/repository/tasks";

type Status = "pending" | "in_progress" | "done";

const COLUMNS: { id: Status; title: string; tone: "info" | "warning" | "success" }[] = [
  { id: "pending", title: "К выполнению", tone: "info" },
  { id: "in_progress", title: "В работе", tone: "warning" },
  { id: "done", title: "Готово", tone: "success" }
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

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric"
  }).format(new Date(dateString));
}

function normalizeStatus(s: string | null): Status {
  if (s === "in_progress" || s === "done") return s;
  return "pending";
}

type Props = {
  initialTasks: TaskRow[];
};

export function TasksKanban({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<TaskRow[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<TaskRow | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    setDraggedTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overId = String(over.id);

    // Determine target status — overId might be a column id or a task id
    let targetStatus: Status | null = null;
    if (COLUMNS.some((c) => c.id === overId)) {
      targetStatus = overId as Status;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) targetStatus = normalizeStatus(overTask.status);
    }

    if (!targetStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const currentStatus = normalizeStatus(task.status);
    if (currentStatus === targetStatus) return;

    // Optimistic update
    const previousStatus = task.status;
    const finalStatus = targetStatus;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: finalStatus } : t))
    );

    startTransition(() => {
      void (async () => {
        try {
          const supabase = getSupabaseBrowserClient();
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;

          const response = await fetch(`/api/tasks/${taskId}/status`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ status: finalStatus })
          });

          const payload = (await response.json()) as { ok?: boolean; message?: string };

          if (!response.ok || payload.ok === false) {
            // Rollback
            setTasks((prev) =>
              prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
            );
            toast.error(payload.message ?? "Не удалось обновить статус");
            return;
          }

          const colTitle = COLUMNS.find((c) => c.id === finalStatus)?.title ?? finalStatus;
          toast.success(`Перенесено в «${colTitle}»`);
        } catch (err) {
          // Rollback on network error
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t))
          );
          toast.error(err instanceof Error ? err.message : "Сетевая ошибка");
        }
      })();
    });
  };

  const tasksByStatus = (status: Status) =>
    tasks.filter((t) => normalizeStatus(t.status) === status);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnTasks = tasksByStatus(col.id);
          return (
            <KanbanColumn
              key={col.id}
              id={col.id}
              title={col.title}
              tone={col.tone}
              count={columnTasks.length}
            >
              <SortableContext items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex min-h-[200px] flex-col gap-2">
                  {columnTasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-[var(--hse-border)] bg-[var(--hse-page-bg)]/40 p-4 text-center text-xs text-[var(--hse-text-muted)]">
                      Пусто. Перетащи задачу сюда.
                    </p>
                  ) : (
                    columnTasks.map((task) => <TaskCard key={task.id} task={task} />)
                  )}
                </div>
              </SortableContext>
            </KanbanColumn>
          );
        })}
      </div>

      <DragOverlay>
        {draggedTask ? <TaskCard task={draggedTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  id,
  title,
  tone,
  count,
  children
}: {
  id: Status;
  title: string;
  tone: "info" | "warning" | "success";
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-2xl border bg-white p-4 transition-colors ${
        isOver ? "border-[var(--hse-blue)] bg-[var(--hse-light)]/30" : "border-[var(--hse-border)]"
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <StatusBadge label={String(count)} tone={tone} />
      </div>
      {children}
    </div>
  );
}

function TaskCard({ task, dragging = false }: { task: TaskRow; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };

  const dueDate = formatDate(task.due_date);

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab rounded-xl border border-[var(--hse-border)] bg-white p-3 shadow-sm transition-all hover:border-[var(--hse-blue)]/30 active:cursor-grabbing ${
        dragging ? "rotate-1 shadow-lg ring-2 ring-[var(--hse-blue)]/30" : ""
      }`}
    >
      <p className="text-sm font-medium text-slate-900">{task.title || "Без названия"}</p>
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {task.priority && (
          <StatusBadge
            label={PRIORITY_LABEL[task.priority] ?? task.priority}
            tone={PRIORITY_TONE[task.priority] ?? "default"}
          />
        )}
        {dueDate && (
          <span className="text-[11px] text-[var(--hse-text-muted)]">До {dueDate}</span>
        )}
      </div>
    </article>
  );
}
