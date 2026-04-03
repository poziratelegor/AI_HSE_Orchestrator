import Link from "next/link";
import LogoutButton from "@/components/auth/LogoutButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Обзор", emoji: "📊" },
  { href: "/dashboard/assistant", label: "Ассистент", emoji: "✨" },
  { href: "/dashboard/documents", label: "Документы", emoji: "📄" },
  { href: "/dashboard/letters", label: "Письма", emoji: "✉️" },
  { href: "/dashboard/tasks", label: "Задачи", emoji: "✅" },
  { href: "/dashboard/analytics", label: "Аналитика", emoji: "📈" },
];

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Brand */}
        <div className="border-b border-gray-200 px-5 py-4">
          <span className="text-lg font-bold text-indigo-600">StudyFlow AI</span>
          <p className="mt-0.5 text-xs text-gray-400">AI-ассистент студента</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
            >
              <span className="text-base leading-none">{link.emoji}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="border-t border-gray-200 px-3 py-3">
          <LogoutButton />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
