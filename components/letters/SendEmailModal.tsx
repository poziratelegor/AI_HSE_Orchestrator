"use client";

import { useEffect, useState, useRef } from "react";
import { ActionButton } from "@/components/dashboard/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Props = {
  open: boolean;
  initialSubject: string;
  body: string;
  studentName?: string | null;
  onClose: () => void;
  onSent: () => void;
};

export function SendEmailModal({ open, initialSubject, body, studentName, onClose, onSent }: Props) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [sending, setSending] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTo("");
      setSubject(initialSubject);
      setFieldError(null);
    }
  }, [open, initialSubject]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, sending, onClose]);

  // Focus first input when modal opens
  useEffect(() => {
    if (open && dialogRef.current) {
      const firstInput = dialogRef.current.querySelector<HTMLInputElement>("input");
      firstInput?.focus();
    }
  }, [open]);

  if (!open) return null;

  const validateEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const handleSend = async () => {
    setFieldError(null);

    const normalizedTo = to.trim();
    if (!validateEmail(normalizedTo)) {
      setFieldError("Введи корректный email — например, prof@hse.ru");
      return;
    }
    if (!subject.trim()) {
      setFieldError("Тема не может быть пустой");
      return;
    }

    setSending(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          to: normalizedTo,
          subject: subject.trim(),
          body: body.trim(),
          studentName: studentName ?? undefined
        })
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || payload.ok === false) {
        toast.error(payload.message ?? "Не удалось отправить письмо.");
        return;
      }

      toast.success("Письмо отправлено");
      onSent();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Сетевая ошибка");
    } finally {
      setSending(false);
    }
  };

  const preview = body.length > 200 ? `${body.slice(0, 200)}…` : body;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-email-title"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-fade-in-scale"
      >
        <h2 id="send-email-title" className="text-lg font-semibold text-slate-900">Отправить письмо</h2>
        <p className="mt-1 text-xs text-[var(--hse-text-muted)]">Через интегрированный email-сервис.</p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="email-to" className="block text-sm font-medium text-slate-700">
              Кому <span className="text-red-500">*</span>
            </label>
            <input
              id="email-to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="prof@hse.ru"
              disabled={sending}
              className="mt-1 block w-full rounded-xl border border-[var(--hse-border)] bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder-[var(--hse-icon-muted)] transition focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)] disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="email-subject" className="block text-sm font-medium text-slate-700">
              Тема <span className="text-red-500">*</span>
            </label>
            <input
              id="email-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sending}
              className="mt-1 block w-full rounded-xl border border-[var(--hse-border)] bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)] disabled:opacity-50"
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-700">Предпросмотр текста</p>
            <div className="mt-1 max-h-32 overflow-y-auto rounded-xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] p-3 text-xs whitespace-pre-wrap text-slate-700">
              {preview}
            </div>
          </div>

          {fieldError && (
            <p role="alert" className="rounded-xl border border-[var(--hse-danger)]/20 bg-[var(--hse-danger-bg)] px-3 py-2 text-sm text-[var(--hse-danger)]">
              {fieldError}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <ActionButton label="Отменить" secondary onClick={onClose} disabled={sending} />
          <ActionButton label={sending ? "Отправляем…" : "Отправить"} onClick={() => void handleSend()} loading={sending} />
        </div>
      </div>
    </div>
  );
}
