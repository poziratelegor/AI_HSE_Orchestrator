import type { ReactNode } from "react";

// ─── Tone system ──────────────────────────────────────────────────────────────
type Tone = "default" | "success" | "warning" | "danger" | "info";

// ─── Layout ───────────────────────────────────────────────────────────────────
export function DashboardContainer({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8">
      {children}
    </main>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────
type HeaderAction = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle: string;
  action?: HeaderAction;
}) {
  return (
    <header className="mb-8 flex flex-col gap-3 border-b border-[var(--hse-border)] pb-6 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 lg:text-[28px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--hse-text-muted)]">
          {subtitle}
        </p>
      </div>
      {action && <ActionButton label={action.label} href={action.href} className="shrink-0 self-start" />}
    </header>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────
const FOCUS_RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)] focus-visible:ring-offset-1";

export function ActionButton({
  label,
  href,
  secondary = false,
  ghost = false,
  onClick,
  disabled = false,
  loading = false,
  type = "button",
  className = ""
}: {
  label: string;
  href?: string;
  secondary?: boolean;
  ghost?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  let base: string;

  if (ghost) {
    base = `inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-[var(--hse-blue)]
      transition-all duration-150 hover:bg-[rgba(15,45,105,0.06)] hover:-translate-y-px active:translate-y-0 ${FOCUS_RING}`;
  } else if (secondary) {
    base = `inline-flex items-center gap-1.5 rounded-xl border border-[var(--hse-blue)] bg-white px-4 py-2 text-sm font-medium text-[var(--hse-blue)]
      transition-all duration-150 hover:bg-[var(--hse-light)] hover:-translate-y-px active:translate-y-0 ${FOCUS_RING}`;
  } else {
    base = `inline-flex items-center gap-1.5 rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white
      transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 ${FOCUS_RING}`;
  }

  const cls = `${base} disabled:cursor-not-allowed disabled:opacity-50 ${className}`;

  if (href && !disabled) {
    return <a href={href} className={cls}>{label}</a>;
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={cls}>
      {loading ? <DotsSpinner muted={!secondary && !ghost} /> : null}
      {!loading && label}
      {loading && <span className="sr-only">Загрузка</span>}
    </button>
  );
}

// ─── Dots spinner (for buttons) ───────────────────────────────────────────────
export function DotsSpinner({ muted = false }: { muted?: boolean }) {
  const color = muted ? "bg-white/80" : "bg-[var(--hse-blue)]";
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className={`typing-dot ${color}`} />
      <span className={`typing-dot ${color}`} />
      <span className={`typing-dot ${color}`} />
    </span>
  );
}

// ─── Spinner (ring, for status indicators) ───────────────────────────────────
export function Spinner({
  size = "md",
  muted = false
}: {
  size?: "sm" | "md" | "lg";
  muted?: boolean;
}) {
  const sz = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-6 w-6" : "h-4 w-4";
  const color = muted
    ? "border-white/30 border-t-white"
    : "border-[var(--hse-light)] border-t-[var(--hse-accent)]";
  return (
    <span
      className={`${sz} animate-spin rounded-full border-2 ${color}`}
      role="status"
      aria-label="Загрузка"
    />
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
export function SectionCard({
  title,
  subtitle,
  children,
  action
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--hse-border)] bg-white shadow-[0_1px_3px_rgba(15,45,105,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,45,105,0.12)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--hse-border)] px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--hse-text-muted)]">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  hint,
  tone = "default"
}: {
  label: string;
  value: string;
  hint: string;
  tone?: Tone;
}) {
  const topBar: Record<Tone, string> = {
    success: "bg-[var(--hse-success)]",
    warning: "bg-[var(--hse-warning)]",
    danger:  "bg-[var(--hse-danger)]",
    info:    "bg-[var(--hse-accent)]",
    default: "bg-[var(--hse-blue)]"
  };

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[var(--hse-border)] bg-white pt-2 pb-5 px-5 shadow-[0_1px_3px_rgba(15,45,105,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(15,45,105,0.12)]">
      {/* Top accent bar */}
      <div className={`absolute left-0 top-0 h-[3px] w-full ${topBar[tone]}`} aria-hidden="true" />
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-[var(--hse-icon-muted)]">
        {label}
      </p>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1.5 text-xs text-[var(--hse-text-muted)]">{hint}</p>
    </article>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
export function StatusBadge({
  label,
  tone = "default"
}: {
  label: string;
  tone?: Tone;
}) {
  const styles: Record<Tone, { bg: string; text: string }> = {
    success: { bg: "bg-[var(--hse-success-bg)]", text: "text-[var(--hse-success)]" },
    warning: { bg: "bg-[var(--hse-warning-bg)]", text: "text-[var(--hse-warning)]" },
    danger:  { bg: "bg-[var(--hse-danger-bg)]",  text: "text-[var(--hse-danger)]" },
    info:    { bg: "bg-[var(--hse-info-bg)]",    text: "text-[var(--hse-info)]" },
    default: { bg: "bg-slate-100",               text: "text-slate-600" }
  };

  const { bg, text } = styles[tone];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 ${bg} ${text}`}>
      <StatusIcon tone={tone} />
      {label}
    </span>
  );
}

function StatusIcon({ tone }: { tone: Tone }) {
  if (tone === "success") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "danger") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <path d="M3 3l4 4M7 3l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
        <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }
  if (tone === "info") {
    // Mini spinning ring
    return <Spinner size="sm" />;
  }
  return null;
}

// ─── Inline alert ─────────────────────────────────────────────────────────────
export function InlineAlert({
  message,
  tone = "danger"
}: {
  message: string;
  tone?: Tone;
}) {
  const styles: Record<Tone, string> = {
    danger:  "bg-[var(--hse-danger-bg)] text-[var(--hse-danger)] border-[var(--hse-danger)]/20",
    warning: "bg-[var(--hse-warning-bg)] text-amber-800 border-[var(--hse-warning)]/30",
    success: "bg-[var(--hse-success-bg)] text-[var(--hse-success)] border-[var(--hse-success)]/20",
    info:    "bg-[var(--hse-info-bg)] text-[var(--hse-info)] border-[var(--hse-info)]/20",
    default: "bg-slate-50 text-slate-700 border-slate-200"
  };

  return (
    <p
      role="alert"
      className={`rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed ${styles[tone]}`}
    >
      {message}
    </p>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Фильтры">
      {children}
    </div>
  );
}

export function FilterPill({
  label,
  active = false,
  href,
  onClick
}: {
  label: string;
  active?: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const cls = [
    "rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-150",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)]",
    active
      ? "border-[var(--hse-blue)]/30 bg-[var(--hse-light)] text-[var(--hse-blue)] shadow-sm"
      : "border-[var(--hse-border)] bg-white text-slate-600 hover:border-[var(--hse-blue)]/30 hover:bg-[var(--hse-light)]/50"
  ].join(" ");

  if (href) {
    return <a href={href} className={cls} aria-current={active ? "page" : undefined}>{label}</a>;
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-pressed={active}>
      {label}
    </button>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────
export function DataTableShell({
  headers,
  rows
}: {
  headers: string[];
  rows: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--hse-border)] bg-white shadow-[0_1px_3px_rgba(15,45,105,0.08)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--hse-border)]">
          <thead>
            <tr className="bg-[var(--hse-page-bg)]">
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--hse-icon-muted)]"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hse-border)]/50">{rows}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--hse-border)] bg-[var(--hse-page-bg)]/60 px-6 py-12 text-center">
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-[var(--hse-border)]"
        aria-hidden="true"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" className="text-[var(--hse-icon-muted)]">
          <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 7v5M11 14.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-[var(--hse-text-muted)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ─── Table row utility (hover + transition) ───────────────────────────────────
export function TableRow({
  children,
  onClick
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={[
        "transition-colors duration-100",
        onClick
          ? "cursor-pointer hover:bg-[var(--hse-light)]/30 active:bg-[var(--hse-light)]/60"
          : "hover:bg-[var(--hse-page-bg)]/80"
      ].join(" ")}
    >
      {children}
    </tr>
  );
}

// ─── Section divider ──────────────────────────────────────────────────────────
export function SectionDivider({ label }: { label?: string }) {
  if (!label) return <hr className="my-6 border-[var(--hse-border)]" />;
  return (
    <div className="my-6 flex items-center gap-3">
      <hr className="flex-1 border-[var(--hse-border)]" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--hse-icon-muted)]">
        {label}
      </span>
      <hr className="flex-1 border-[var(--hse-border)]" />
    </div>
  );
}

// ─── Skeleton loaders ─────────────────────────────────────────────────────────

/** Single shimmer line. */
export function SkeletonText({
  width = "100%",
  height = "0.875rem",
  className = ""
}: {
  width?: string;
  height?: string;
  className?: string;
}) {
  return (
    <span
      className={`skeleton block rounded ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Full stat-card shaped skeleton. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-[var(--hse-border)] bg-white pt-2 pb-5 px-5 shadow-[0_1px_3px_rgba(15,45,105,0.08)] ${className}`}
      aria-hidden="true"
    >
      <div className="absolute left-0 top-0 h-[3px] w-full skeleton" />
      <div className="skeleton mt-3 mb-3 h-2.5 w-20 rounded" />
      <div className="skeleton mb-2 h-8 w-16 rounded" />
      <div className="skeleton h-2.5 w-28 rounded" />
    </article>
  );
}

/** Table-row shaped skeleton. */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  const widths = ["55%", "20%", "15%", "10%", "12%", "18%"];
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3 rounded" style={{ width: widths[i % widths.length] }} />
        </td>
      ))}
    </tr>
  );
}

/** Section card shaped skeleton. */
export function SkeletonSection({ rows = 3 }: { rows?: number }) {
  return (
    <section className="rounded-2xl border border-[var(--hse-border)] bg-white shadow-[0_1px_3px_rgba(15,45,105,0.08)]" aria-hidden="true">
      <div className="border-b border-[var(--hse-border)] px-6 py-4">
        <div className="skeleton mb-1.5 h-4 w-36 rounded" />
        <div className="skeleton h-2.5 w-56 rounded" />
      </div>
      <div className="space-y-3 p-6">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton h-3 rounded" style={{ width: i % 2 === 0 ? "80%" : "60%" }} />
        ))}
      </div>
    </section>
  );
}
