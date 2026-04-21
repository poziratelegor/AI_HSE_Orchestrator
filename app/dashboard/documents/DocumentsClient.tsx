"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActionButton,
  DataTableShell,
  EmptyState,
  FilterBar,
  FilterPill,
  InlineAlert,
  SectionCard,
  SkeletonRow,
  StatusBadge
} from "@/components/dashboard/ui";
import { HowItWorks } from "@/components/dashboard/HowItWorks";
import type { DocumentRow } from "@/lib/repository/documents";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Props = {
  initialDocuments: DocumentRow[];
  loadError?: string | null;
};

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

export function formatBytes(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

const STATUS_RU: Record<string, string> = {
  pending: "Ожидает",
  processing: "Обрабатывается",
  ready: "Готово",
  partial: "Частично",
  failed: "Ошибка"
};

type StatusFilter = "all" | "in_progress" | "ready" | "partial" | "failed";

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Все",
  in_progress: "В обработке",
  ready: "Готово",
  partial: "Частично",
  failed: "Ошибка"
};

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === "all" || value === "in_progress" || value === "ready" || value === "partial" || value === "failed";
}

export default function DocumentsClient({ initialDocuments, loadError = null }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [error, setError] = useState<string | null>(loadError);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Initialize filter from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("status");
    if (isStatusFilter(fromUrl)) {
      setStatusFilter(fromUrl);
    }
  }, []);

  const handleFilterChange = (next: StatusFilter) => {
    setStatusFilter(next);
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (next === "all") {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  };

  const hasProcessing = useMemo(
    () => documents.some((d) => d.processing_status === "processing" || d.processing_status === "pending"),
    [documents]
  );

  const filteredDocuments = useMemo(() => {
    if (statusFilter === "all") return documents;
    if (statusFilter === "in_progress") {
      return documents.filter((d) => d.processing_status === "processing" || d.processing_status === "pending");
    }
    return documents.filter((d) => d.processing_status === statusFilter);
  }, [documents, statusFilter]);

  const refreshDocuments = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: dbError } = await supabase
      .from("documents")
      .select("id, title, mime_type, processing_status, file_size_bytes, error_message, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (dbError) {
      setError(`Не удалось обновить документы: ${dbError.message}`);
      return;
    }

    setDocuments((data ?? []) as DocumentRow[]);
    setError(null);
  };

  useEffect(() => {
    if (!hasProcessing) return;
    const interval = window.setInterval(() => void refreshDocuments(), 5000);
    return () => window.clearInterval(interval);
  }, [hasProcessing]);

  const uploadFile = async (file: File) => {
    const ALLOWED = ["application/pdf", "text/plain", "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm"];
    if (!ALLOWED.includes(file.type)) {
      toast.error(`Формат ${file.type || file.name.split(".").pop()} не поддерживается.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    // Animate progress bar (cosmetic — real progress not available via fetch)
    const progressInterval = window.setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + Math.random() * 15, 85));
    }, 300);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string };

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok || payload.ok === false) {
        const msg = payload.message ?? "Не удалось загрузить документ.";
        setError(msg);
        toast.error(msg);
        return;
      }

      toast.success(`«${file.name}» принят в обработку`);
      await refreshDocuments();
    } catch (uploadError) {
      clearInterval(progressInterval);
      const msg = uploadError instanceof Error ? uploadError.message : "Сетевая ошибка при загрузке.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  };

  // Drag & drop handlers
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  const rows = filteredDocuments.map((doc) => {
    const status = doc.processing_status ?? "pending";
    const tone =
      status === "ready" ? "success" :
      status === "failed" ? "danger" :
      status === "partial" ? "warning" :
      "info";

    return (
      <tr key={doc.id} className="animate-fade-in transition-colors hover:bg-[var(--hse-light)]/20">
        <td className="px-4 py-3 text-sm font-medium text-slate-800">{doc.title || "Без названия"}</td>
        <td className="px-4 py-3 text-sm text-[var(--hse-text-muted)]">{doc.mime_type?.replace("application/", "").replace("text/", "") || "—"}</td>
        <td className="px-4 py-3 text-sm text-[var(--hse-text-muted)]">{formatBytes(doc.file_size_bytes)}</td>
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge label={STATUS_RU[status] ?? status} tone={tone} />
          </div>
          {status === "failed" && doc.error_message && (
            <p className="mt-1 max-w-xs truncate text-xs text-red-500" title={doc.error_message}>
              {doc.error_message}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-slate-500">{formatDate(doc.updated_at ?? doc.created_at)}</td>
      </tr>
    );
  });

  return (
    <div className="space-y-6">
      <div className="animate-slide-up mb-2">
        <HowItWorks
          title="Как работает поиск по документам"
          steps={[
            { title: "Загрузи PDF или аудио", desc: "Система нарезает на чанки и создаёт векторные эмбеддинги через text-embedding-3-small." },
            { title: "Задай вопрос ассистенту", desc: "Запрос расширяется до 3 вариантов, ищутся ближайшие чанки через pgvector." },
            { title: "Ответ со ссылками", desc: "GPT отвечает строго по найденным фрагментам, приводя цитаты из документа." },
          ]}
        />
      </div>
      <div className="animate-slide-up">
        <SectionCard title="Библиотека документов" subtitle="Загружайте PDF, TXT или аудиофайлы для поиска и анализа.">

          {/* Upload zone */}
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={(e) => void onDrop(e)}
            onClick={() => !isUploading && inputRef.current?.click()}
            className={[
              "mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200",
              isDragging
                ? "border-[var(--hse-blue)] bg-[var(--hse-light)] scale-[1.01]"
                : "border-[var(--hse-border)] bg-[var(--hse-page-bg)]/60 hover:border-[var(--hse-blue)]/30 hover:bg-[var(--hse-page-bg)]",
              isUploading ? "pointer-events-none opacity-80" : ""
            ].join(" ")}
            role="button"
            tabIndex={0}
            aria-label="Загрузить документ"
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept=".pdf,.txt,.mp3,.mp4,.wav,.ogg,.webm"
              disabled={isUploading}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file) void uploadFile(file);
                e.currentTarget.value = "";
              }}
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-3 animate-fade-in">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hse-light)]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--hse-blue)]/25 border-t-[var(--hse-blue)]" />
                </div>
                <p className="text-sm font-medium text-slate-700">Загрузка файла…</p>
                {/* Progress bar */}
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[var(--hse-blue)] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">{Math.round(uploadProgress)}%</p>
              </div>
            ) : (
              <div className={`flex flex-col items-center gap-2 transition-transform duration-200 ${isDragging ? "scale-105" : ""}`}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${isDragging ? "bg-[var(--hse-blue)] text-white" : "bg-[var(--hse-border)] text-[var(--hse-icon-muted)]"}`}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 12V4M9 4L6 7M9 4l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className={`text-sm font-medium transition-colors duration-200 ${isDragging ? "text-[var(--hse-blue)]" : "text-slate-700"}`}>
                  {isDragging ? "Отпустите файл здесь" : "Перетащите файл или нажмите для выбора"}
                </p>
                <p className="text-xs text-slate-400">PDF, TXT, MP3, MP4, WAV · до 20 МБ</p>
              </div>
            )}
          </div>

          {hasProcessing && (
            <div className="mb-4 flex animate-fade-in items-center gap-2 rounded-xl border border-[var(--hse-info-bg)] bg-[var(--hse-info-bg)] px-3 py-2">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--hse-accent)] opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--hse-accent)]" />
              </span>
              <span className="text-xs text-[var(--hse-info)]">Автообновление каждые 5 секунд</span>
            </div>
          )}

          {error && <InlineAlert message={error} tone="danger" />}

          {documents.length > 0 && (
            <div className="mb-4 animate-fade-in">
              <FilterBar>
                {(Object.keys(FILTER_LABELS) as StatusFilter[]).map((key) => (
                  <FilterPill
                    key={key}
                    label={FILTER_LABELS[key]}
                    active={statusFilter === key}
                    onClick={() => handleFilterChange(key)}
                  />
                ))}
              </FilterBar>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="animate-fade-in">
              <EmptyState
                title="Документы пока не загружены"
                description="Перетащите файл в зону выше или нажмите для выбора. PDF, TXT и аудио поддерживаются."
                action={
                  <ActionButton
                    label="Выбрать файл"
                    onClick={() => inputRef.current?.click()}
                  />
                }
              />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="animate-fade-in">
              <EmptyState
                title="По выбранному фильтру ничего нет"
                description={`Документов в статусе «${FILTER_LABELS[statusFilter]}» сейчас нет. Выберите другой фильтр или загрузите новый файл.`}
                action={
                  <ActionButton
                    label="Показать все"
                    onClick={() => handleFilterChange("all")}
                    secondary
                  />
                }
              />
            </div>
          ) : (
            <div className="animate-fade-in">
              <DataTableShell
                headers={["Документ", "Тип", "Размер", "Статус", "Обновлён"]}
                rows={
                  isUploading
                    ? <><SkeletonRow cols={5} />{rows}</>
                    : <>{rows}</>
                }
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
