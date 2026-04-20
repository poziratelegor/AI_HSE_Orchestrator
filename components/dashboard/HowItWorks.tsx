"use client";

import { useState } from "react";

type Step = { title: string; desc: string };

export function HowItWorks({
  title = "Как это работает",
  steps,
}: {
  title?: string;
  steps: Step[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--hse-blue)]">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="7" cy="7" r="6" />
            <path d="M7 5v.01M7 7v3" />
          </svg>
          {title}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 5l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-[var(--hse-border)] px-4 pb-4 pt-3">
          <ol className="space-y-3">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--hse-light)] text-xs font-bold text-[var(--hse-blue)]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--hse-text)]">
                    {step.title}
                  </p>
                  <p className="text-xs text-[var(--hse-text-muted)]">
                    {step.desc}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
