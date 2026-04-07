import type { ReactNode } from "react";

/**
 * Shared two-column layout for all auth pages.
 * Left: HSE brand panel (hidden on mobile)
 * Right: form content
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#F3F6FA]">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:w-[400px] lg:shrink-0 lg:flex-col lg:justify-between bg-[#003A8C] px-10 py-12">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-200/50">StudyFlow</p>
          <p className="mt-1 text-lg font-semibold text-white">AI Ассистент</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#003A8C]/50">StudyFlow</p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">AI Ассистент</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-slate-400 transition focus:border-[#003A8C] focus:outline-none focus:ring-2 focus:ring-[#003A8C]/20";

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <hr className="flex-1 border-slate-200" />
      <span className="text-xs text-slate-400">{label}</span>
      <hr className="flex-1 border-slate-200" />
    </div>
  );
}

export function AuthErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
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
      className="w-full rounded-xl bg-[#003A8C] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0A4B9D] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#003A8C]/40"
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
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
