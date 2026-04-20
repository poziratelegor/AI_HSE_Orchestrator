"use client";

import { useEffect, useState } from "react";
import { TOAST_EVENT, type ToastPayload, type ToastTone } from "@/lib/toast";

const TONE_STYLES: Record<ToastTone, { bar: string; icon: string; bg: string; text: string }> = {
  success: {
    bar:  "bg-emerald-500",
    icon: "text-emerald-600",
    bg:   "bg-white border-emerald-100",
    text: "text-slate-800"
  },
  error: {
    bar:  "bg-red-500",
    icon: "text-red-500",
    bg:   "bg-white border-red-100",
    text: "text-slate-800"
  },
  warning: {
    bar:  "bg-amber-400",
    icon: "text-amber-500",
    bg:   "bg-white border-amber-100",
    text: "text-slate-800"
  },
  info: {
    bar:  "bg-blue-500",
    icon: "text-blue-500",
    bg:   "bg-white border-blue-100",
    text: "text-slate-800"
  }
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  const cls = `${TONE_STYLES[tone].icon} shrink-0`;
  if (tone === "success") return (
    <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
      <path d="m5 8 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (tone === "error") return (
    <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  if (tone === "warning") return (
    <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2L14.5 13H1.5L8 2Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M8 7v2.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
  return (
    <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15"/>
      <path d="M8 7v4M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

interface ActiveToast extends ToastPayload {
  exiting: boolean;
}

export function Toaster() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<ToastPayload>).detail;
      setToasts((prev) => [...prev.slice(-4), { ...payload, exiting: false }]);

      // Auto-dismiss
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === payload.id ? { ...t, exiting: true } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== payload.id));
        }, 220);
      }, payload.durationMs);
    };

    window.addEventListener(TOAST_EVENT, handler);
    return () => window.removeEventListener(TOAST_EVENT, handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Уведомления"
      className="pointer-events-none fixed right-4 top-4 z-[9999] flex flex-col gap-2"
    >
      {toasts.map((t) => {
        const s = TONE_STYLES[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className={[
              "pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg",
              s.bg,
              t.exiting ? "animate-toast-out" : "animate-toast-in"
            ].join(" ")}
          >
            {/* Colored left bar */}
            <div className={`absolute left-0 top-0 h-full w-1 rounded-l-2xl ${s.bar}`} aria-hidden="true" />
            <ToastIcon tone={t.tone} />
            <p className={`flex-1 text-sm leading-relaxed ${s.text}`}>{t.message}</p>
            <button
              onClick={() =>
                setToasts((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, exiting: true } : x))
                )
              }
              className="ml-auto shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label="Закрыть"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
