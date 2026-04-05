"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, EmptyState, SectionCard, StatusBadge } from "@/components/dashboard/ui";
import type { LetterRow } from "@/lib/supabase/queries/letters";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const RECIPIENT_LABEL: Record<string, string> = {
  teacher: "Преподаватель",
  dean_office: "Учебный офис",
  admin: "Администрация",
  curator: "Куратор",
  other: "Другое"
};

type Props = {
  initialLetters: LetterRow[];
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

export default function LettersClient({ initialLetters, loadError = null }: Props) {
  const [letters, setLetters] = useState<LetterRow[]>(initialLetters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const router = useRouter();

  const isEmpty = useMemo(() => !error && letters.length === 0, [error, letters.length]);

  const refreshFromDb = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: dbError } = await supabase
      .from("letters")
      .select("id, subject, body, recipient_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (dbError) {
      setError(`Не удалось обновить список писем: ${dbError.message}`);
      return;
    }

    setLetters((data ?? []) as LetterRow[]);
    setError(null);
  };

  const onGenerate = async () => {
    const normalized = text.trim();
    if (!normalized) {
      setError("Опишите суть письма перед генерацией.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/letters/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text: normalized })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: { subject?: string; body?: string; status?: string; recipient_type?: string };
      };

      if (!response.ok || payload.ok === false) {
        setError(payload.message ?? "Не удалось сгенерировать письмо. Попробуйте снова.");
        return;
      }

      const generated = payload.data;

      if (generated?.subject || generated?.body) {
        const optimisticLetter: LetterRow = {
          id: `optimistic-${Date.now()}`,
          subject: generated.subject ?? "Новое письмо",
          body: generated.body ?? "",
          recipient_type: generated.recipient_type ?? "other",
          status: generated.status ?? "draft",
          created_at: new Date().toISOString()
        };

        setLetters((current) => [optimisticLetter, ...current].slice(0, 20));
        setExpandedId(optimisticLetter.id);
      }

      setText("");

      await refreshFromDb();
      startRefresh(() => router.refresh());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Сетевая ошибка при генерации письма.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <SectionCard title="Создать письмо" subtitle="Опишите ситуацию — ассистент соберёт черновик официального письма.">
          <div className="space-y-3">
            <textarea
              className="h-28 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="Коротко опишите ситуацию и цель письма"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onGenerate}
                disabled={isGenerating}
                className="inline-flex items-center rounded-xl bg-[#003A8C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A4B9D] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGenerating ? "Генерируем..." : "Собрать черновик"}
              </button>
              {isRefreshing && <span className="text-xs text-slate-500">Обновляем историю…</span>}
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </div>
        </SectionCard>

        <SectionCard title="Последние письма" subtitle="История последних 20 писем.">
          {isEmpty ? (
            <EmptyState
              title="Писем пока нет"
              description="Сгенерируйте первое письмо — оно появится здесь сразу после успешного запроса."
            />
          ) : (
            <div className="space-y-3">
              {letters.map((letter) => {
                const isExpanded = expandedId === letter.id;
                const recipient = RECIPIENT_LABEL[letter.recipient_type ?? ""] ?? "Другое";

                return (
                  <article key={letter.id} className="rounded-xl border border-slate-200 p-4">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : letter.id)}
                      onKeyDown={(event) => {
                        if (event.key === " " || event.key === "Enter") {
                          event.preventDefault();
                          setExpandedId(isExpanded ? null : letter.id);
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{letter.subject || "Без темы"}</p>
                        <StatusBadge label={letter.status || "draft"} tone={letter.status === "sent" ? "success" : "info"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Получатель: {recipient}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(letter.created_at)}</p>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm whitespace-pre-wrap text-slate-700">
                        {letter.body || "Текст письма отсутствует."}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Категории шаблонов" subtitle="Быстрый выбор получателя.">
          <div className="flex flex-wrap gap-2">
            {Object.values(RECIPIENT_LABEL).map((category) => (
              <ActionButton key={category} label={category} secondary />
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
