"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  {
    href: "/dashboard",
    label: "Обзор",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.5" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8" />
      </svg>
    ),
    exact: true
  },
  {
    href: "/dashboard/assistant",
    label: "Ассистент",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1C4.13 1 1 3.91 1 7.5c0 1.4.46 2.7 1.24 3.75L1.5 14l2.94-1.06A7.07 7.07 0 0 0 8 14c3.87 0 7-2.91 7-6.5S11.87 1 8 1Z" fill="currentColor" opacity="0.9" />
        <path d="M5 8h6M5 6h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/dashboard/documents",
    label: "Документы",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 2a1 1 0 0 1 1-1h5.586a1 1 0 0 1 .707.293l2.414 2.414A1 1 0 0 1 13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2Z" fill="currentColor" opacity="0.8" />
        <path d="M9 1v3.5a.5.5 0 0 0 .5.5H13" fill="currentColor" opacity="0.4" />
        <path d="M5 9h6M5 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    href: "/dashboard/lectures",
    label: "Лекции",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6 14V3l9-2v11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="3.5" cy="14" r="2.5" fill="currentColor" opacity="0.7" />
        <circle cx="12.5" cy="12" r="2.5" fill="currentColor" opacity="0.7" />
      </svg>
    )
  },
  {
    href: "/dashboard/letters",
    label: "Письма",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="3" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.8" />
        <path d="m1.5 4 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: "/dashboard/tasks",
    label: "Задачи",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-3" fill="currentColor" opacity="0.7" />
        <rect x="5" y="1" width="6" height="4" rx="1" fill="currentColor" />
        <path d="m5 9 1.5 1.5L11 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    href: "/dashboard/analytics",
    label: "Аналитика",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="9" width="3" height="6" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="6" y="5" width="3" height="10" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="11" y="2" width="3" height="13" rx="1" fill="currentColor" opacity="0.9" />
      </svg>
    )
  }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Основная навигация">
      {NAV_LINKS.map((link) => {
        const isActive = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={[
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-white/15 text-white shadow-sm"
                : "text-blue-100/75 hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
            ].join(" ")}
          >
            {/* Active left border */}
            {isActive && (
              <span
                className="absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--hse-accent)]"
                aria-hidden="true"
              />
            )}
            <span
              className={[
                "shrink-0 transition-opacity",
                isActive ? "opacity-100 text-white" : "opacity-60 text-blue-100"
              ].join(" ")}
            >
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
