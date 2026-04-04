import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

type HeaderAction = {
  label: string;
  href?: string;
};

function toneClasses(tone: Tone) {
  switch (tone) {
    case "success":
      return "bg-[#EAF1FB] text-[#0F3972] ring-1 ring-[#C9D9EF]";
    case "warning":
      return "bg-[#F1F5FB] text-[#274A7A] ring-1 ring-[#D6E1F1]";
    case "danger":
      return "bg-[#EFF3F9] text-[#2D4668] ring-1 ring-[#D4DEEC]";
    case "info":
      return "bg-[#E7F0FC] text-[#003A8C] ring-1 ring-[#C3D7F4]";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export function DashboardContainer({ children }: { children: ReactNode }) {
  return <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>;
}

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
    <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-[30px] font-semibold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
      </div>
      {action && <ActionButton label={action.label} href={action.href} />}
    </header>
  );
}

export function ActionButton({ label, href, secondary = false }: { label: string; href?: string; secondary?: boolean }) {
  const baseClass = secondary
    ? "inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7AA2D6]"
    : "inline-flex items-center rounded-xl bg-[#003A8C] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0A4B9D] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7AA2D6]";

  if (href) {
    return (
      <a href={href} className={baseClass}>
        {label}
      </a>
    );
  }

  return <button className={baseClass}>{label}</button>;
}

export function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

export function StatusBadge({ label, tone = "default" }: { label: string; tone?: Tone }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses(tone)}`}>{label}</span>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}

export function FilterPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <button
      className={`rounded-xl border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-[#1B4F9D] bg-[#EAF1FB] text-[#003A8C]"
          : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

export function DataTableShell({ headers, rows }: { headers: string[]; rows: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {headers.map(header => (
              <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{rows}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-[#F7F9FC] px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
