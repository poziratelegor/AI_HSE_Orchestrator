"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTableShell, EmptyState, SectionCard, StatusBadge } from "@/components/dashboard/ui";
import type { DocumentRow } from "@/lib/supabase/queries/documents";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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

export default function DocumentsClient({ initialDocuments, loadError = null }: Props) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [error, setError] = useState<string | null>(loadError);
  const [isUploading, setIsUploading] = useState(false);

  const hasProcessing = useMemo(
    () => documents.some((document) => document.processing_status === "processing" || document.processing_status === "pending"),
    [documents]
  );

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

    const interval = window.setInterval(() => {
      void refreshDocuments();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [hasProcessing]);

  const onFileSelected = async (file: File | null) => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size
        })
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || payload.ok === false) {
        setError(payload.message ?? "Не удалось загрузить документ.");
        return;
      }

      await refreshDocuments();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Сетевая ошибка при загрузке документа.");
    } finally {
      setIsUploading(false);
    }
  };

  const rows = documents.map((doc) => {
    const status = doc.processing_status ?? "pending";
    const tone =
      status === "ready"
        ? "success"
        : status === "failed"
        ? "danger"
        : status === "processing" || status === "pending"
        ? "info"
        : "default";

    return (
      <tr key={doc.id}>
        <td className="px-4 py-3 text-sm font-medium text-slate-800">{doc.title || "Без названия"}</td>
        <td className="px-4 py-3 text-sm text-slate-600">{doc.mime_type || "—"}</td>
        <td className="px-4 py-3 text-sm text-slate-600">{formatBytes(doc.file_size_bytes)}</td>
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            {(status === "processing" || status === "pending") && (
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" aria-hidden="true" />
            )}
            <StatusBadge label={status} tone={tone} />
          </div>
          {status === "failed" && doc.error_message && (
            <p className="mt-1 max-w-xs text-xs text-red-700" title={doc.error_message}>
              {doc.error_message}
            </p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(doc.updated_at ?? doc.created_at)}</td>
      </tr>
    );
  });

  return (
    <div className="space-y-6">
      <SectionCard title="Библиотека документов" subtitle="Реальные документы и статусы обработки.">
        <div className="mb-4 flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-xl bg-[#003A8C] px-4 py-2 text-sm font-medium text-white hover:bg-[#0A4B9D]">
            {isUploading ? "Загрузка..." : "Загрузить документ"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.txt,.mp3,.mp4,.wav"
              disabled={isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void onFileSelected(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {hasProcessing && <span className="text-xs text-slate-500">Автообновление каждые 5 секунд</span>}
        </div>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

        {documents.length === 0 ? (
          <EmptyState
            title="Документы пока не загружены"
            description="Добавьте PDF/TXT/аудио/видео-файл, чтобы ассистент мог обработать материалы."
          />
        ) : (
          <DataTableShell headers={["Документ", "Тип", "Размер", "Статус", "Обновлён"]} rows={rows} />
        )}
      </SectionCard>
    </div>
  );
}
