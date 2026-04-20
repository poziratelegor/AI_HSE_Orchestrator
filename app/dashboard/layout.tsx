import LogoutButton from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { Toaster } from "@/components/dashboard/Toaster";

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[var(--hse-page-bg)]">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-white/10 bg-[var(--hse-blue)]">
        <div className="border-b border-white/10 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-100/80">StudyFlow AI</p>
          <p className="mt-1 text-lg font-semibold text-white">Dashboard</p>
          <p className="mt-0.5 text-[11px] text-[var(--hse-accent)]/80">for ВШЭ</p>
        </div>

        <SidebarNav />

        <div className="border-t border-white/10 px-3 py-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 overflow-auto">{children}</div>
      <Toaster />
    </div>
  );
}
