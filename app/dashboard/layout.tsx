import LogoutButton from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { Toaster } from "@/components/dashboard/Toaster";
import { getCurrentUserWithRole } from "@/lib/repository/auth";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { role, fullName, email } = await getCurrentUserWithRole();
  const displayName = fullName ?? email ?? "Студент";
  const initial = (displayName.trim()[0] ?? "?").toUpperCase();

  return (
    <div className="flex min-h-screen bg-[var(--hse-page-bg)]">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[var(--hse-blue)]">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-100/80">StudyFlow AI</p>
          <p className="mt-1 text-lg font-semibold text-white">Dashboard</p>
          <p className="mt-0.5 text-[11px] text-[var(--hse-accent)]/80">for ВШЭ</p>
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

        <SidebarNav role={role} />

        <div className="border-t border-white/10 px-3 py-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 overflow-auto">{children}</div>
      <Toaster />
    </div>
  );
}
