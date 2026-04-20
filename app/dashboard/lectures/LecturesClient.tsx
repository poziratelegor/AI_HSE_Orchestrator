"use client";

import { useState } from "react";
import {
  DashboardContainer,
  PageHeader,
  SectionCard,
  InlineAlert,
} from "@/components/dashboard/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type LectureNotesResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  actionItems: string[];
};

type Status =
  | "idle"
  | "transcribing"
  | "generating"
  | "done"
  | "error";

const ACCEPTED_EXT = /\.(mp3|mp4|m4a|wav|ogg|webm|flac)$/i;

export default function LecturesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [notes, setNotes] = useState<LectureNotesResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);

  const handleFile = (f: File) => {
    if (!ACCEPTED_EXT.test(f.name)) {
      setErrorMsg("Поддерживаются: MP3, MP4, M4A, WAV, OGG, WebM, FLAC");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setErrorMsg("Файл больше 25 МБ — лимит Whisper API.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setNotes(null);
    setTranscript(null);
    setStatus("idle");
  };

  const handleGenerate = async () => {
    if (!file) return;
    setStatus("transcribing");
    setErrorMsg(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // 1. Транскрибация
      const form = new FormData();
      form.append("audio", file);

      const transcRes = await fetch("/api/transcribe/microphone", {
        method: "POST",
        headers,
        body: form,
      });
      const transcData = (await transcRes.json()) as {
        ok: boolean;
        transcript?: string;
        message?: string;
      };
      if (!transcData.ok || !transcData.transcript) {
        throw new Error(transcData.message ?? "Ошибка транскрипции");
      }
      setTranscript(transcData.transcript);

      // 2. Генерация конспекта
      setStatus("generating");
      const notesRes = await fetch("/api/lecture-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ transcript: transcData.transcript }),
      });
      const notesData = (await notesRes.json()) as {
        ok: boolean;
        data?: LectureNotesResult;
        message?: string;
      };
      if (!notesData.ok || !notesData.data) {
        throw new Error(notesData.message ?? "Ошибка генерации конспекта");
      }

      setNotes(notesData.data);
      setStatus("done");
      toast.success("Конспект готов");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Неизвестная ошибка"
      );
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setStatus("idle");
    setNotes(null);
    setTranscript(null);
    setErrorMsg(null);
  };

  return (
    <DashboardContainer>
      <PageHeader
        title="Конспект лекции"
        subtitle="Загрузи аудиозапись — получи структурированный конспект с ключевыми идеями и терминами."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Левая колонка — загрузка */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            title="Загрузка аудио"
            subtitle="MP3, M4A, WAV, OGG, WebM — до 25 МБ"
          >
            {/* Dropzone */}
            <label
              className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors
                ${file
                  ? "border-[var(--hse-blue)] bg-[var(--hse-light)]/30"
                  : "border-[var(--hse-border)] hover:border-[var(--hse-blue)] hover:bg-[var(--hse-light)]/20"
                }`}
            >
              <input
                type="file"
                accept=".mp3,.mp4,.m4a,.wav,.ogg,.webm,.flac,audio/*"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              {/* Music icon */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--hse-blue)"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span className="text-sm text-[var(--hse-text-muted)]">
                {file
                  ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} МБ)`
                  : "Нажми или перетащи аудиофайл"}
              </span>
            </label>

            {errorMsg && (
              <div className="mt-3">
                <InlineAlert message={errorMsg} tone="danger" />
              </div>
            )}

            {/* Кнопка запуска */}
            {file && (status === "idle" || status === "error") && (
              <button
                onClick={() => void handleGenerate()}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--hse-blue)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <polygon points="5,3 13,8 5,13" />
                </svg>
                Создать конспект
              </button>
            )}

            {/* Прогресс */}
            {(status === "transcribing" || status === "generating") && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] px-4 py-3">
                <span className="flex gap-0.5">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
                <span className="text-sm text-[var(--hse-text-muted)]">
                  {status === "transcribing"
                    ? "Распознаю речь (Whisper)…"
                    : "Генерирую конспект (GPT)…"}
                </span>
              </div>
            )}
          </SectionCard>

          {/* Результат — конспект */}
          {status === "done" && notes && (
            <SectionCard title={notes.title} subtitle={notes.summary}>
              {/* Ключевые идеи */}
              {notes.keyPoints.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--hse-text-muted)]">
                    Ключевые идеи
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {notes.keyPoints.map((pt, i) => (
                      <li key={i} className="text-sm text-[var(--hse-text)]">
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Термины */}
              {notes.definitions.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--hse-text-muted)]">
                    Термины
                  </p>
                  <div className="space-y-2">
                    {notes.definitions.map((d, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-[var(--hse-border)] bg-[var(--hse-page-bg)] px-3 py-2"
                      >
                        <span className="text-sm font-medium text-[var(--hse-blue)]">
                          {d.term}
                        </span>
                        <span className="text-sm text-[var(--hse-text)]">
                          {" — "}
                          {d.definition}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Что изучить */}
              {notes.actionItems.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--hse-text-muted)]">
                    Рекомендации
                  </p>
                  <ul className="list-disc space-y-1 pl-4">
                    {notes.actionItems.map((item, i) => (
                      <li key={i} className="text-sm text-[var(--hse-text)]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={reset}
                className="mt-2 text-xs text-[var(--hse-accent)] hover:underline"
              >
                Загрузить другой файл
              </button>
            </SectionCard>
          )}
        </div>

        {/* Правая колонка — подсказки + транскрипт */}
        <div className="space-y-6">
          <SectionCard title="Как это работает" subtitle="Три шага.">
            <ol className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Загрузи аудио",
                  desc: "Запись лекции в MP3, M4A, WAV и др. Максимум 25 МБ.",
                },
                {
                  step: "2",
                  title: "Whisper распознаёт речь",
                  desc: "OpenAI Whisper транскрибирует аудио в текст на русском.",
                },
                {
                  step: "3",
                  title: "GPT создаёт конспект",
                  desc: "Структурированные заметки: темы, термины, ключевые идеи.",
                },
              ].map((s) => (
                <li key={s.step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--hse-light)] text-xs font-bold text-[var(--hse-blue)]">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--hse-text)]">
                      {s.title}
                    </p>
                    <p className="text-xs text-[var(--hse-text-muted)]">
                      {s.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          {/* Транскрипт */}
          {transcript && (
            <SectionCard
              title="Транскрипт"
              subtitle="Распознанный текст лекции"
            >
              <div className="max-h-64 overflow-y-auto rounded-lg bg-[var(--hse-page-bg)] p-3">
                <p className="text-xs leading-relaxed text-[var(--hse-text-muted)] whitespace-pre-wrap">
                  {transcript.length > 3000
                    ? transcript.slice(0, 3000) + "\n\n…(обрезано для отображения)"
                    : transcript}
                </p>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Ограничения" subtitle="">
            <ul className="space-y-1.5 text-xs text-[var(--hse-text-muted)]">
              <li>Максимальный размер: 25 МБ</li>
              <li>Лучшее качество: чистая речь без фонового шума</li>
              <li>Язык: русский (по умолчанию)</li>
              <li>Длинные лекции (&gt;1 час) могут потребовать разделения</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </DashboardContainer>
  );
}
