import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";
import { SidebarNav } from "@/components/dashboard/SidebarNav";

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#F3F6FA]">
      {/* Sidebar */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-[#1C4F99]/40 bg-[#003A8C]">
        {/* Brand */}
        <div className="border-b border-white/10 px-5 py-5">
          <Link href="/dashboard" className="block group">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-blue-200/60 group-hover:text-blue-200/80 transition-colors">
              StudyFlow
            </p>
            <p className="mt-0.5 text-base font-semibold leading-tight text-white">
              AI Ассистент
            </p>
          </Link>
        </div>

        {/* Navigation */}
        <SidebarNav />

        {/* Bottom: logout */}
        <div className="border-t border-white/10 px-3 py-3">
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto min-w-0">
        {children}
      </div>
    </div>
  );
}
