"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

type Props = {
  title?: string;
  text: string;
  /** Дополнительные подсказки/метаданные показать сверху */
  meta?: React.ReactNode;
};

/**
 * Универсальный блок результата: чистый текст + кнопка «Скопировать».
 * Используется во всех местах, где показываем ответ workflow пользователю.
 */
export function ResultBlock({ title = "Результат", text, meta }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Скопировано");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <div className="animate-fade-in-scale rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="m3 6 2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{title}</p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
          title="Скопировать в буфер обмена"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 6 2 2 4-4" />
              </svg>
              Готово
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
                <path d="M2 8.5V2.5A0.5.5 0 0 1 2.5 2H8" />
              </svg>
              Скопировать
            </>
          )}
        </button>
      </div>
      {meta && <div className="mb-2">{meta}</div>}
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-800">
        {text}
      </pre>
    </div>
  );
}
