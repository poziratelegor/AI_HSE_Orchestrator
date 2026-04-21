"use client";

import { useState } from "react";

type LinkResponse = {
  ok: boolean;
  code?: string;
  expiresAt?: string;
  deepLink?: string;
  botUsername?: string | null;
  message?: string;
};

export function TelegramLinkCard() {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<LinkResponse | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setCopied(false);
    try {
      const res = await fetch("/api/profile/telegram-link", { method: "POST" });
      const data = (await res.json()) as LinkResponse;
      setLink(data);
    } catch {
      setLink({ ok: false, message: "Не удалось сгенерировать ссылку. Попробуйте ещё раз." });
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link?.deepLink) return;
    try {
      await navigator.clipboard.writeText(link.deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  const expiresMin = link?.expiresAt
    ? Math.max(0, Math.round((new Date(link.expiresAt).getTime() - Date.now()) / 60_000))
    : null;

  return (
    <div className="mt-6 rounded-2xl border border-[var(--hse-border)] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Telegram-бот</h2>
          <p className="mt-1 text-sm text-slate-500">
            Привяжите Telegram, чтобы общаться с ассистентом из мессенджера.
            Задачи, письма и напоминания будут синхронизироваться с дашбордом.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          ✈️ @{link?.botUsername ?? "StudyflowBot"}
        </span>
      </div>

      {!link?.ok && (
        <div className="mt-5 flex flex-col items-start gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-xl bg-[var(--hse-blue)] px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 disabled:opacity-50"
          >
            {loading ? "Генерирую ссылку…" : "🔗 Привязать Telegram"}
          </button>
          {link?.message && (
            <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {link.message}
            </p>
          )}
        </div>
      )}

      {link?.ok && link.deepLink && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-slate-600">
            Откройте ссылку ниже в Telegram. Код одноразовый, действует
            <span className="font-semibold"> {expiresMin} мин</span>.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <a
              href={link.deepLink}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate rounded-xl border border-[var(--hse-border)] bg-slate-50 px-3.5 py-2.5 font-mono text-sm text-blue-700 hover:underline"
            >
              {link.deepLink}
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-xl border border-[var(--hse-border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {copied ? "✓ Скопировано" : "📋 Копировать"}
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="rounded-xl border border-[var(--hse-border)] px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              ↻ Новый код
            </button>
          </div>

          <details className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">
              Что делать после клика?
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Откроется чат с ботом — нажмите «Старт» / «Запустить».</li>
              <li>Бот ответит «✅ Аккаунт успешно привязан».</li>
              <li>Готово — пишите боту любые задачи, как в веб-ассистенте.</li>
            </ol>
          </details>
        </div>
      )}
    </div>
  );
}
