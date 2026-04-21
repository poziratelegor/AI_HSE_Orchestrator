"use client";

import React from "react";

type WorkflowOption = {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
};

const WORKFLOW_OPTIONS: WorkflowOption[] = [
  {
    id: "letter_generator",
    label: "Написать письмо",
    desc: "Официальное письмо в деканат, куратору, преподавателю",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="3" width="14" height="10" rx="1.5" fill="currentColor" opacity="0.8" />
        <path d="m1.5 4 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "rag_qa",
    label: "Вопрос по документам",
    desc: "Ответ по загруженным материалам со ссылками",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.8" />
        <path d="m11 11 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 7h4M7 5v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "task_extractor",
    label: "Извлечь задачи",
    desc: "Список задач и дедлайнов из текста или силлабуса",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-3" fill="currentColor" opacity="0.7" />
        <rect x="5" y="1" width="6" height="4" rx="1" fill="currentColor" />
        <path d="m5 9 1.5 1.5L11 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "study_plan",
    label: "Составить план",
    desc: "Учебный план или план подготовки",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
        <path d="M5 2V1M11 2V1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M1 6h14" stroke="currentColor" strokeWidth="1.1" opacity="0.5" />
        <rect x="4" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
        <rect x="7" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
        <rect x="10" y="9" width="2" height="2" rx="0.5" fill="currentColor" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: "explain_this",
    label: "Объяснить тему",
    desc: "Простое объяснение сложной темы",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1a4 4 0 0 1 2 7.46V10H6V8.46A4 4 0 0 1 8 1Z" fill="currentColor" opacity="0.8" />
        <rect x="6" y="11" width="4" height="1.5" rx="0.5" fill="currentColor" opacity="0.6" />
        <rect x="6.5" y="13.5" width="3" height="1.5" rx="0.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
  {
    id: "cheat_sheet",
    label: "Шпаргалка",
    desc: "Краткий конспект определений и формул",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M3 2a1 1 0 0 1 1-1h5.586a1 1 0 0 1 .707.293l2.414 2.414A1 1 0 0 1 13 4.414V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2Z" fill="currentColor" opacity="0.8" />
        <path d="M9 1v3.5a.5.5 0 0 0 .5.5H13" fill="currentColor" opacity="0.4" />
        <path d="M5 9h6M5 11h4M5 7h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "quiz_generator",
    label: "Тест для самопроверки",
    desc: "Вопросы с вариантами по любой теме",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
        <path d="M6 6.5a2 2 0 1 1 2.5 1.94c-.3.08-.5.35-.5.64V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="8" cy="12" r="0.75" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "lecture_insight",
    label: "Анализ лекции",
    desc: "Темы, термины и ключевые идеи из текста лекции",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="5" y="1.5" width="6" height="8" rx="3" stroke="currentColor" strokeWidth="1.3" opacity="0.8" />
        <path d="M2.5 7.5a5.5 5.5 0 0 0 11 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="8" y1="13" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

type Props = {
  question?: string;
  onSelect: (workflowId: string, prompt: string) => void;
  originalQuery: string;
};

export function WorkflowPicker({ question, onSelect, originalQuery }: Props) {
  return (
    <div className="rounded-2xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] p-5">
      {/* Header */}
      <div className="mb-4 flex items-start gap-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[var(--hse-light)] text-[var(--hse-blue)]"
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.4" />
            <path d="M7 4v3.5l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {question ?? "Уточни, что тебе нужно:"}
          </p>
          <p className="mt-0.5 text-xs text-[var(--hse-text-muted)]">
            Выбери подходящий инструмент, и я обработаю твой запрос точнее.
          </p>
        </div>
      </div>

      {/* Grid of workflow cards */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {WORKFLOW_OPTIONS.map((option, i) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id, originalQuery)}
            className="animate-fade-in group flex flex-col gap-2 rounded-xl border border-[var(--hse-border)] bg-white p-3 text-left transition-all duration-150 hover:border-[var(--hse-blue)]/30 hover:bg-[var(--hse-light)] hover:-translate-y-px hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)] focus-visible:ring-offset-1 active:translate-y-0"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--hse-light)] text-[var(--hse-blue)] transition-colors duration-150 group-hover:bg-[var(--hse-blue)] group-hover:text-white">
              {option.icon}
            </span>
            <span className="text-xs font-semibold leading-snug text-slate-800 group-hover:text-[var(--hse-blue)]">
              {option.label}
            </span>
            <span className="text-[11px] leading-tight text-[var(--hse-text-muted)] group-hover:text-slate-600">
              {option.desc}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
