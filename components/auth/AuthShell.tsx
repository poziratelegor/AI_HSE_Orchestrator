import type { ReactNode } from "react";

/**
 * Shared two-column layout for all auth pages.
 * Left: HSE brand panel (hidden on mobile)
 * Right: form content in a white card
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--hse-page-bg)]">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[400px] lg:shrink-0 lg:flex-col lg:justify-between bg-[var(--hse-blue)] px-10 py-12">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-200/50">StudyFlow</p>
          <p className="mt-1 text-lg font-semibold text-white">AI Ассистент</p>
          <p className="mt-0.5 text-[11px] text-[var(--hse-accent)]/80">for ВШЭ</p>
        </div>
        <div>
          <p className="text-sm leading-relaxed text-blue-100/75">
            Один запрос на естественном языке — система сама выбирает нужный сценарий и возвращает результат.
          </p>
          <ul className="mt-8 space-y-3">
            {[
              "Генерация официальных писем",
              "Ответы по загруженным материалам",
              "Выделение задач и дедлайнов",
              "Конспекты лекций"
            ].map(item => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-blue-100/65">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <circle cx="7" cy="7" r="6" fill="white" opacity="0.12" />
                  <path d="m4 7 2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[10px] text-blue-200/25">StudyFlow AI</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand */}
          <div className="mb-8 lg:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--hse-blue)]/50">StudyFlow</p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">AI Ассистент</p>
            <p className="text-[11px] text-[var(--hse-accent)]">for ВШЭ</p>
          </div>
          {/* White card wrapper */}
          <div className="rounded-2xl bg-white px-8 py-8 shadow-[0_4px_24px_rgba(15,45,105,0.10)] ring-1 ring-[var(--hse-border)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "mt-1 block w-full rounded-xl border border-[var(--hse-border)] bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-[var(--hse-icon-muted)] transition focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]";

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <hr className="flex-1 border-[var(--hse-border)]" />
      <span className="text-xs text-[var(--hse-icon-muted)]">{label}</span>
      <hr className="flex-1 border-[var(--hse-border)]" />
    </div>
  );
}

export function AuthErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-[var(--hse-danger)]/20 bg-[var(--hse-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--hse-danger)]">
      {message}
    </p>
  );
}

export function AuthPrimaryButton({
  children,
  loading,
  disabled,
  type = "submit"
}: {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="w-full rounded-xl bg-[var(--hse-blue)] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)]"
    >
      {children}
    </button>
  );
}

export function AuthSecondaryButton({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl border border-[var(--hse-border)] bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-[var(--hse-blue)]/30 hover:bg-[var(--hse-light)]/50 hover:-translate-y-px active:translate-y-0 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
