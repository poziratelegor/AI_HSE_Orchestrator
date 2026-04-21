"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

type Props = {
  role: "user" | "admin" | null;
  displayName: string;
  initial: string;
  children: React.ReactNode;
};

/**
 * Адаптивная оболочка дашборда.
 * Desktop (≥md): фиксированный сайдбар слева 256px.
 * Mobile: бургер-кнопка → slide-over сайдбар поверх контента, dimmable overlay.
 */
export function DashboardShell({ role, displayName, initial, children }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Закрывать сайдбар при переходе на новый роут (mobile UX)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Esc закрывает
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Блокировать скролл body когда mobile-sidebar открыт
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <div className="flex min-h-screen bg-[var(--hse-page-bg)]">
      {/* ── Mobile top bar ─────────────────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[var(--hse-blue)] px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-white">StudyFlow AI</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hse-accent)]/30 text-xs font-semibold text-white">
          {initial}
        </div>
      </div>

      {/* ── Overlay (mobile only) ──────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-[var(--hse-blue)] transition-transform duration-200 ease-out",
          "md:sticky md:top-0 md:z-auto md:h-screen md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        ].join(" ")}
        aria-label="Боковая навигация"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-100/80">StudyFlow AI</p>
            <p className="mt-1 text-lg font-semibold text-white">Dashboard</p>
            <p className="mt-0.5 text-[11px] text-[var(--hse-accent)]/80">for ВШЭ</p>
          </div>
          {/* Закрыть на mobile */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--hse-accent)]/30 text-sm font-semibold text-white">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{displayName}</p>
            <p className="truncate text-[11px] text-blue-100/70">
              {role === "admin" ? "Администратор" : "Студент"}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarNav role={role} />
        </div>

        <div className="border-t border-white/10 px-3 py-3">
          <LogoutButton />
        </div>
      </aside>

      {/* ── Контент ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-hidden pt-14 md:pt-0">{children}</div>
    </div>
  );
}
