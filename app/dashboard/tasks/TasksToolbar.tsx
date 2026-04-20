"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Priority = "low" | "medium" | "high" | "urgent";

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "Низкий" },
  { value: "medium", label: "Средний" },
  { value: "high", label: "Высокий" },
  { value: "urgent", label: "Срочно" }
];

const inputClass =
  "mt-1 block w-full rounded-xl border border-[var(--hse-border)] bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-[var(--hse-icon-muted)] transition focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]";

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function TasksToolbar() {
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px"
        >
          <span className="text-lg leading-none">+</span> Добавить задачу
        </button>
        <button
          type="button"
          onClick={() => setImportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hse-border)] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[var(--hse-blue)]/40 hover:bg-slate-50"
        >
          📥 Импорт Excel/CSV
        </button>
      </div>

      {createOpen && <CreateTaskDialog onClose={() => setCreateOpen(false)} />}
      {importOpen && <ImportTasksDialog onClose={() => setImportOpen(false)} />}
    </>
  );
}

// ─── Создание задачи вручную ────────────────────────────────────────────────

function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Введите название задачи");
      return;
    }
    setLoading(true);

    try {
      const headers = await authHeader();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          due_date: dueDate || null,
          priority
        })
      });
      const payload = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || payload.ok === false) {
        toast.error(payload.message ?? "Не удалось создать задачу");
        setLoading(false);
        return;
      }
      toast.success("Задача создана");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Сетевая ошибка");
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Новая задача" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="t-title" className="block text-sm font-medium text-slate-700">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            id="t-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Сдать ДЗ по матану"
            className={inputClass}
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="t-desc" className="block text-sm font-medium text-slate-700">
            Описание <span className="text-xs font-normal text-slate-400">(опционально)</span>
          </label>
          <textarea
            id="t-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Детали, ссылки, требования…"
            rows={3}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="t-due" className="block text-sm font-medium text-slate-700">
              Дедлайн
            </label>
            <input
              id="t-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="t-prio" className="block text-sm font-medium text-slate-700">
              Приоритет
            </label>
            <select
              id="t-prio"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={inputClass}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--hse-border)] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--hse-blue-mid)] disabled:opacity-50"
          >
            {loading ? "Сохраняю…" : "Создать"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Импорт Excel/CSV ───────────────────────────────────────────────────────

type ParsedRow = {
  title: string;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  __error?: string;
};

const HEADER_MAP: Record<string, keyof ParsedRow> = {
  // RU
  "название": "title",
  "задача": "title",
  "тема": "title",
  "описание": "description",
  "детали": "description",
  "дедлайн": "due_date",
  "срок": "due_date",
  "дата": "due_date",
  "приоритет": "priority",
  // EN
  "title": "title",
  "name": "title",
  "task": "title",
  "description": "description",
  "details": "description",
  "due": "due_date",
  "due_date": "due_date",
  "deadline": "due_date",
  "date": "due_date",
  "priority": "priority"
};

const PRIORITY_NORM: Record<string, Priority> = {
  низкий: "low", низ: "low", low: "low",
  средний: "medium", сред: "medium", medium: "medium", med: "medium",
  высокий: "high", выс: "high", high: "high",
  срочно: "urgent", срочный: "urgent", urgent: "urgent", critical: "urgent"
};

function normalizeHeader(h: string): keyof ParsedRow | null {
  const k = h.trim().toLowerCase();
  return HEADER_MAP[k] ?? null;
}

function normalizePriority(v: unknown): Priority {
  if (v == null) return "medium";
  const s = String(v).trim().toLowerCase();
  return PRIORITY_NORM[s] ?? "medium";
}

function normalizeDate(v: unknown): { value: string | null; error?: string } {
  if (v == null || v === "") return { value: null };

  // SheetJS может вернуть Date если cellDates:true
  if (v instanceof Date) {
    return Number.isNaN(v.getTime())
      ? { value: null, error: "невалидная дата" }
      : { value: v.toISOString() };
  }

  // Excel serial number (дни с 1899-12-30)
  if (typeof v === "number" && v > 25_000 && v < 80_000) {
    const utcDays = v - 25569; // 1970-01-01 в Excel = 25569
    const d = new Date(utcDays * 86_400_000);
    return Number.isNaN(d.getTime())
      ? { value: null, error: "невалидная дата" }
      : { value: d.toISOString() };
  }

  const s = String(v).trim();
  if (!s) return { value: null };
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return { value: null, error: `неверный формат даты: "${s}"` };
  return { value: d.toISOString() };
}

function ImportTasksDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParseError(null);
    setRows(null);
    setFileName(file.name);
    setParsing(true);

    try {
      // Динамический импорт чтобы xlsx не попадал в основной бандл
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      if (!firstSheet) throw new Error("В файле нет листов");

      // header:1 → массив массивов; первая строка — заголовки
      const matrix: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, {
        header: 1,
        defval: null,
        blankrows: false
      });
      if (matrix.length < 2) throw new Error("Файл не содержит строк с данными");

      const headers = (matrix[0] as unknown[]).map((h) =>
        h == null ? "" : String(h)
      );
      const colIndex: Partial<Record<keyof ParsedRow, number>> = {};
      headers.forEach((h, idx) => {
        const key = normalizeHeader(h);
        if (key && colIndex[key] === undefined) colIndex[key] = idx;
      });

      if (colIndex.title === undefined) {
        throw new Error(
          "Не найден столбец с названием задачи. Допустимые заголовки: «Название»/«Задача»/«Title»/«Name»."
        );
      }

      const parsed: ParsedRow[] = [];
      for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r];
        const titleRaw = row[colIndex.title!];
        const title = titleRaw == null ? "" : String(titleRaw).trim();
        if (!title) continue; // пустая строка — пропускаем

        const descRaw =
          colIndex.description !== undefined ? row[colIndex.description] : null;
        const description =
          descRaw == null || String(descRaw).trim() === ""
            ? null
            : String(descRaw).trim();

        const dueRaw = colIndex.due_date !== undefined ? row[colIndex.due_date] : null;
        const dueParsed = normalizeDate(dueRaw);

        const priority = normalizePriority(
          colIndex.priority !== undefined ? row[colIndex.priority] : null
        );

        parsed.push({
          title,
          description,
          due_date: dueParsed.value,
          priority,
          __error: dueParsed.error
        });
      }

      if (parsed.length === 0) throw new Error("Не найдено ни одной задачи в файле");

      setRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Не удалось разобрать файл");
    } finally {
      setParsing(false);
    }
  }

  async function handleUpload() {
    if (!rows || rows.length === 0) return;
    setUploading(true);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          tasks: rows.map((r) => ({
            title: r.title,
            description: r.description,
            due_date: r.due_date,
            priority: r.priority
          }))
        })
      });
      const payload = (await res.json()) as {
        ok?: boolean;
        created?: number;
        skipped?: number;
        message?: string;
      };
      if (!res.ok || payload.ok === false) {
        toast.error(payload.message ?? "Импорт не удался");
        setUploading(false);
        return;
      }
      const skippedTxt = payload.skipped ? `, пропущено ${payload.skipped}` : "";
      toast.success(`Импортировано: ${payload.created ?? rows.length}${skippedTxt}`);
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Сетевая ошибка");
      setUploading(false);
    }
  }

  return (
    <ModalShell title="Импорт задач из Excel/CSV" onClose={onClose} wide>
      {!rows && (
        <>
          <div className="rounded-xl border border-dashed border-[var(--hse-border)] bg-[var(--hse-page-bg)]/40 p-5 text-sm text-slate-600">
            <p className="mb-2 font-medium text-slate-800">Формат файла</p>
            <p>
              Первая строка — заголовки. Поддерживаемые столбцы (RU/EN, регистр не важен):
            </p>
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs">
              <li>
                <b>Название</b> / <b>Title</b> — обязательно
              </li>
              <li>
                <b>Описание</b> / <b>Description</b> — опционально
              </li>
              <li>
                <b>Дедлайн</b> / <b>Due</b> / <b>Deadline</b> — опционально (дата или ISO)
              </li>
              <li>
                <b>Приоритет</b> / <b>Priority</b> — low/medium/high/urgent (опционально)
              </li>
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Поддерживаются: .xlsx, .xls, .csv. Берём только первый лист.
            </p>
          </div>

          <div className="mt-4 flex flex-col items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
              className="rounded-xl bg-[var(--hse-blue)] px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[var(--hse-blue-mid)] disabled:opacity-50"
            >
              {parsing ? "Разбираю файл…" : "Выбрать файл"}
            </button>
            {fileName && !parsing && !parseError && (
              <p className="text-xs text-slate-500">Файл: {fileName}</p>
            )}
            {parseError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {parseError}
              </p>
            )}
          </div>
        </>
      )}

      {rows && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Найдено задач: <b>{rows.length}</b>
              {rows.some((r) => r.__error) && (
                <span className="ml-2 text-amber-600">
                  (есть строки с ошибками — будут пропущены полем due_date)
                </span>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setRows(null);
                setFileName("");
              }}
              className="text-xs text-[var(--hse-blue)] hover:underline"
            >
              Выбрать другой файл
            </button>
          </div>

          <div className="max-h-80 overflow-auto rounded-xl border border-[var(--hse-border)]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Название</th>
                  <th className="px-3 py-2">Дедлайн</th>
                  <th className="px-3 py-2">Приоритет</th>
                  <th className="px-3 py-2">Описание</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className="border-t border-[var(--hse-border)]">
                    <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-1.5 font-medium text-slate-800">{r.title}</td>
                    <td className="px-3 py-1.5 text-slate-600">
                      {r.due_date
                        ? new Date(r.due_date).toLocaleString("ru-RU")
                        : r.__error ? <span className="text-amber-600">{r.__error}</span> : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-slate-600">{r.priority}</td>
                    <td className="px-3 py-1.5 text-slate-500">
                      {r.description ? (
                        <span className="line-clamp-1">{r.description}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length > 100 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-center text-slate-400">
                      …и ещё {rows.length - 100}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--hse-border)] bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[var(--hse-blue-mid)] disabled:opacity-50"
            >
              {uploading ? "Импортирую…" : `Импортировать ${rows.length}`}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── Modal shell ────────────────────────────────────────────────────────────

function ModalShell({
  title,
  onClose,
  wide,
  children
}: {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
