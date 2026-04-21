"use client";

import { useState, useRef, useEffect } from "react";

export type CitationSource = {
  index: number;
  documentTitle?: string;
  excerpt: string; // first ~200 chars of chunk_text
};

type Props = {
  index: number;
  sources?: CitationSource[];
};

/**
 * Inline citation reference like [1] with a hover/focus tooltip
 * showing the document name and excerpt of the cited chunk.
 */
export function Citation({ index, sources = [] }: Props) {
  const [open, setOpen] = useState(false);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = `citation-tooltip-${index}`;

  const source = sources.find((s) => s.index === index);

  // Hide on outside click (touch devices)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <span
      ref={tooltipRef}
      className="relative inline-block align-baseline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <sup
        tabIndex={0}
        aria-describedby={tooltipId}
        className="cursor-pointer text-[var(--hse-accent)] hover:underline focus:outline-none focus-visible:underline"
      >
        [{index}]
      </sup>
      {open && source && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-64 -translate-x-1/2 rounded-xl border border-[var(--hse-border)] bg-white p-3 text-xs leading-relaxed shadow-lg animate-fade-in"
        >
          {source.documentTitle && (
            <span className="block font-semibold text-[var(--hse-blue)]">{source.documentTitle}</span>
          )}
          <span className="mt-1 block text-slate-700">{source.excerpt}</span>
        </span>
      )}
      {open && !source && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-1.5 w-48 -translate-x-1/2 rounded-xl border border-[var(--hse-border)] bg-white p-2 text-xs text-slate-500 shadow-lg animate-fade-in"
        >
          Источник недоступен
        </span>
      )}
    </span>
  );
}
