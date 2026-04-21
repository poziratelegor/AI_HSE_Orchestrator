"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Citation, type CitationSource } from "./Citation";
import { parseCitations } from "@/lib/parseCitations";
import type { ReactNode } from "react";

type Props = {
  content: string;
  sources?: CitationSource[];
};

/**
 * Renders markdown with HSE-themed typography and inline [N] citation tooltips.
 * Does NOT enable rehype-raw — raw HTML is escaped (XSS protection).
 */
export function Markdown({ content, sources = [] }: Props) {
  return (
    <div className="text-sm leading-relaxed text-[var(--hse-text)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mb-3 last:mb-0">{renderWithCitations(children, sources)}</p>
          ),
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-[var(--hse-text)]">{renderWithCitations(children, sources)}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--hse-accent)] hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-[var(--hse-light)] px-1.5 py-0.5 font-mono text-[12.5px] text-[var(--hse-blue)]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] p-3 text-[12.5px] font-mono text-slate-800">
              {children}
            </pre>
          ),
          h1: ({ children }) => <h1 className="mb-3 mt-4 text-lg font-semibold text-slate-900">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-semibold text-slate-900">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-semibold text-slate-800">{children}</h3>,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-4 border-[var(--hse-accent)] bg-[var(--hse-light)]/40 px-3 py-2 italic text-slate-700">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--hse-border)] rounded-xl border border-[var(--hse-border)] text-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => <th className="bg-[var(--hse-page-bg)] px-3 py-2 text-left font-semibold text-slate-700">{children}</th>,
          td: ({ children }) => <td className="border-t border-[var(--hse-border)] px-3 py-2 text-slate-700">{children}</td>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Walks React children, splits text nodes by [N] citations and replaces them with
 * <Citation /> components. Non-string children pass through.
 */
function renderWithCitations(children: ReactNode, sources: CitationSource[]): ReactNode {
  if (typeof children === "string") {
    const segments = parseCitations(children);
    return segments.map((seg, i) =>
      seg.type === "text"
        ? <span key={i}>{seg.value}</span>
        : <Citation key={i} index={seg.value} sources={sources} />
    );
  }

  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string"
        ? <span key={i}>{renderWithCitations(child, sources)}</span>
        : child
    );
  }

  return children;
}
