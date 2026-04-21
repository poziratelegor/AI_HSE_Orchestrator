"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, SectionCard, Spinner, StatusBadge } from "@/components/dashboard/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RecentPromptStatus = "Готово" | "В обработке" | "Ошибка" | "Уточнение" | "Маршрут";

export type RecentPrompt = {
  id: string;
  text: string;
  status: RecentPromptStatus;
  createdAt?: string;
  optimistic?: boolean;
};

type RecentPromptsPanelProps = {
  optimisticPrompts: RecentPrompt[];
  refreshToken?: number;
  onPromptSelect: (text: string) => void;
};

export function RecentPromptsPanel({ optimisticPrompts, refreshToken, onPromptSelect }: RecentPromptsPanelProps) {
  const [historyItems, setHistoryItems] = useState<RecentPrompt[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const response = await fetch("/api/analytics/history?limit=5", {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        const payload = (await response.json()) as {
          ok: boolean;
          items?: Array<{ id: string; text: string; status: RecentPromptStatus; createdAt?: string }>;
        };

        if (!ignore && payload.ok && Array.isArray(payload.items)) {
          setHistoryItems(payload.items);
        }
      } catch {
        // Не блокируем UX карточки ассистента из-за недоступной аналитики.
      } finally {
        if (!ignore) setIsHistoryLoading(false);
      }
    };

    void loadHistory();

    return () => {
      ignore = true;
    };
  }, [refreshToken]);

  const items = useMemo(() => {
    const optimisticOnly = optimisticPrompts.filter((item) => item.optimistic);
    const merged = [...optimisticOnly, ...historyItems];
    const seen = new Set<string>();

    return merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [historyItems, optimisticPrompts]);

  return (
    <SectionCard title="Недавние запросы" subtitle="Последние события вашего аккаунта.">
      <div className="space-y-3">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="animate-fade-in cursor-pointer rounded-xl border border-[var(--hse-border)] p-3 transition-all duration-200 hover:border-[var(--hse-blue)]/20 hover:bg-[var(--hse-light)]/20 hover:-translate-y-px"
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={() => onPromptSelect(item.text)}
          >
            <p className="text-sm text-slate-800">{item.text}</p>
            <div className="mt-2">
              <StatusBadge
                label={item.status}
                tone={item.status === "Готово" ? "success" : item.status === "Ошибка" ? "danger" : "warning"}
              />
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && !isHistoryLoading && (
        <div className="mt-4">
          <EmptyState title="История пока пустая" description="Отправьте первый запрос — событие появится в списке." />
        </div>
      )}

      {isHistoryLoading && (
        <div className="mt-4 flex items-center gap-2 text-xs text-[var(--hse-text-muted)]">
          <Spinner size="sm" /> Обновляю историю…
        </div>
      )}
    </SectionCard>
  );
}
