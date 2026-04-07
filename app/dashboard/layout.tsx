import LogoutButton from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F3F6FA]">
      <aside className="flex w-64 flex-shrink-0 flex-col border-r border-[#184C97] bg-[#003A8C]">
        <div className="border-b border-[#1C4F99] px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-blue-100/80">StudyFlow AI</p>
          <p className="mt-1 text-lg font-semibold text-white">Dashboard</p>
          <p className="mt-1 text-xs text-blue-100/80">Academic productivity workspace</p>
        </div>

        <SidebarNav />

        <div className="border-t border-[#1C4F99] px-3 py-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
