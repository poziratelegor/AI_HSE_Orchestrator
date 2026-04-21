"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, EmptyState, InlineAlert, SectionCard, Spinner, StatusBadge } from "@/components/dashboard/ui";
import { SendEmailModal } from "@/components/letters/SendEmailModal";
import type { LetterRow } from "@/lib/repository/letters";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

const RECIPIENT_LABEL: Record<string, string> = {
  teacher: "Преподаватель",
  dean_office: "Учебный офис",
  admin: "Администрация",
  curator: "Куратор",
  other: "Другое"
};

type Props = {
  initialLetters: LetterRow[];
  loadError?: string | null;
};

function formatDate(dateString: string | null) {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(dateString));
}

export default function LettersClient({ initialLetters, loadError = null }: Props) {
  const [letters, setLetters] = useState<LetterRow[]>(initialLetters);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(loadError);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedBody, setEditedBody] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [sendModalLetter, setSendModalLetter] = useState<LetterRow | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const router = useRouter();

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const copyLetter = async (letter: LetterRow) => {
    const parts: string[] = [];
    if (letter.subject) parts.push(`Тема: ${letter.subject}`);
    if (letter.body) parts.push(letter.body);
    const txt = parts.join("\n\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedId(letter.id);
      toast.success("Скопировано");
      setTimeout(() => setCopiedId((cur) => (cur === letter.id ? null : cur)), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
      return;
    }
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      if (blob.size === 0) {
        setError("Пустое аудио. Запишите голос ещё раз.");
        return;
      }
      setIsTranscribing(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        const form = new FormData();
        form.append("audio", blob, "recording.webm");
        const res = await fetch("/api/transcribe/microphone", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const data = (await res.json()) as { ok: boolean; transcript?: string; message?: string };
        if (data.ok && data.transcript) {
          setText((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript!));
          toast.success("Речь распознана");
        } else {
          setError(data.message ?? "Не удалось распознать речь.");
        }
      } catch {
        setError("Ошибка отправки аудио.");
      } finally {
        setIsTranscribing(false);
      }
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  };

  const startEditing = (letter: LetterRow) => {
    setEditingId(letter.id);
    setEditedBody(letter.body || "");
    setEditedSubject(letter.subject || "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditedBody("");
    setEditedSubject("");
  };

  const saveEditing = async () => {
    if (!editingId) return;

    const normalizedSubject = editedSubject.trim().slice(0, 180);
    const normalizedBody = editedBody;

    // Optimistic локальная запись (ещё не синкнулась с БД)
    if (editingId.startsWith("optimistic-")) {
      setLetters((current) =>
        current.map((l) =>
          l.id === editingId ? { ...l, body: normalizedBody, subject: normalizedSubject } : l
        )
      );
      setEditingId(null);
      setEditedBody("");
      setEditedSubject("");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    const { error: updateError } = await supabase
      .from("letters")
      .update({ subject: normalizedSubject, body: normalizedBody })
      .eq("id", editingId);

    if (updateError) {
      setError(`Не удалось сохранить изменения: ${updateError.message}`);
      return;
    }

    setLetters((current) =>
      current.map((l) =>
        l.id === editingId ? { ...l, body: normalizedBody, subject: normalizedSubject } : l
      )
    );
    setError(null);
    setEditingId(null);
    setEditedBody("");
    setEditedSubject("");
  };

  const isEmpty = useMemo(() => !error && letters.length === 0, [error, letters.length]);

  const refreshFromDb = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error: dbError } = await supabase
      .from("letters")
      .select("id, subject, body, recipient_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (dbError) {
      setError(`Не удалось обновить список писем: ${dbError.message}`);
      return;
    }

    setLetters((data ?? []) as LetterRow[]);
    setError(null);
  };

  const onGenerate = async () => {
    const normalized = text.trim();
    if (!normalized) {
      setError("Опишите суть письма перед генерацией.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/letters/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text: normalized })
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        data?: { subject?: string; body?: string; status?: string; recipient_type?: string };
      };

      if (!response.ok || payload.ok === false) {
        setError(payload.message ?? "Не удалось сгенерировать письмо. Попробуйте снова.");
        return;
      }

      const generated = payload.data;

      if (generated?.subject || generated?.body) {
        const optimisticLetter: LetterRow = {
          id: `optimistic-${Date.now()}`,
          subject: generated.subject ?? "Новое письмо",
          body: generated.body ?? "",
          recipient_type: generated.recipient_type ?? "other",
          status: generated.status ?? "draft",
          created_at: new Date().toISOString()
        };

        setLetters((current) => [optimisticLetter, ...current].slice(0, 20));
        setExpandedId(optimisticLetter.id);
      }

      setText("");

      await refreshFromDb();
      startRefresh(() => router.refresh());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Сетевая ошибка при генерации письма.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <SectionCard title="Создать письмо" subtitle="Опишите ситуацию — ассистент соберёт черновик официального письма.">
          <div className="space-y-3">
            <textarea
              className="h-28 w-full rounded-xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)]/50 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-[var(--hse-icon-muted)] transition-colors focus:border-[var(--hse-blue-mid)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]"
              placeholder="Коротко опишите ситуацию и цель письма"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void toggleRecording()}
                disabled={isGenerating || isTranscribing}
                title={isRecording ? "Остановить запись" : "Записать голос"}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 ${
                  isRecording
                    ? "bg-[var(--hse-danger)] text-white animate-pulse"
                    : "bg-[var(--hse-light)] text-[var(--hse-blue)] hover:bg-[var(--hse-blue)] hover:text-white"
                } disabled:opacity-40`}
              >
                {isTranscribing ? (
                  <span className="flex gap-0.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                ) : isRecording ? (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                    <rect x="2" y="2" width="10" height="10" rx="2" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="5" y="1.5" width="6" height="8" rx="3" />
                    <path d="M2.5 7.5a5.5 5.5 0 0 0 11 0" />
                    <line x1="8" y1="13" x2="8" y2="14.5" />
                    <line x1="5.5" y1="14.5" x2="10.5" y2="14.5" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={isGenerating || !text.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="typing-dot bg-white/80" />
                      <span className="typing-dot bg-white/80" />
                      <span className="typing-dot bg-white/80" />
                    </span>
                    <span className="sr-only">Генерируем</span>
                  </>
                ) : "Собрать черновик"}
              </button>
              {isRefreshing && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Spinner size="sm" />
                  Обновляем историю…
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              🎙️ Длинные аудио (до 5 минут) могут обрабатываться 30–60 секунд.
            </p>
            {error && <InlineAlert message={error} tone="danger" />}
          </div>
        </SectionCard>

        <SectionCard title="Последние письма" subtitle="История последних 20 писем.">
          {isEmpty ? (
            <EmptyState
              title="Писем пока нет"
              description="Сгенерируйте первое письмо — оно появится здесь сразу после успешного запроса."
            />
          ) : (
            <div className="space-y-3">
              {letters.map((letter) => {
                const isExpanded = expandedId === letter.id;
                const recipient = RECIPIENT_LABEL[letter.recipient_type ?? ""] ?? "Другое";

                return (
                  <article key={letter.id} className="rounded-xl border border-[var(--hse-border)] p-4 transition-all duration-200 hover:border-[var(--hse-blue)]/20 hover:bg-[var(--hse-light)]/20 hover:-translate-y-px hover:shadow-sm">
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : letter.id)}
                      onKeyDown={(event) => {
                        if (event.key === " " || event.key === "Enter") {
                          event.preventDefault();
                          setExpandedId(isExpanded ? null : letter.id);
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">{letter.subject || "Без темы"}</p>
                        <StatusBadge label={letter.status || "draft"} tone={letter.status === "sent" ? "success" : "info"} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">Получатель: {recipient}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(letter.created_at)}</p>
                    </button>
                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        {editingId === letter.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              maxLength={180}
                              value={editedSubject}
                              onChange={(e) => setEditedSubject(e.target.value)}
                              className="w-full rounded-lg border border-[var(--hse-border)] bg-white px-3 py-2 text-sm text-slate-900 focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]"
                              placeholder="Тема письма"
                            />
                            <textarea
                              value={editedBody}
                              onChange={(e) => setEditedBody(e.target.value)}
                              className="h-48 w-full rounded-lg border border-[var(--hse-border)] bg-white px-3 py-2 text-sm text-slate-700 focus:border-[var(--hse-blue-mid)] focus:outline-none focus:ring-2 focus:ring-[rgba(55,75,155,0.15)]"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void saveEditing()}
                                className="rounded-xl bg-[var(--hse-blue)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--hse-blue-mid)]"
                              >
                                Сохранить
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                className="rounded-xl border border-[var(--hse-border)] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                Отмена
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="rounded-lg bg-[var(--hse-page-bg)] p-3 text-sm whitespace-pre-wrap text-slate-700">
                              {letter.body || "Текст письма отсутствует."}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void copyLetter(letter)}
                                disabled={!letter.body}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {copiedId === letter.id ? (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="m3 6 2 2 4-4" />
                                    </svg>
                                    Готово
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2" />
                                      <path d="M2 8.5V2.5A0.5.5 0 0 1 2.5 2H8" />
                                    </svg>
                                    Скопировать
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditing(letter)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hse-border)] bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-[var(--hse-blue)]/30 hover:bg-[var(--hse-light)]/50"
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                                  <path d="M9 2l1.5 1.5L4 10H2v-2L8.5 1.5z" />
                                </svg>
                                Редактировать
                              </button>
                              <button
                                type="button"
                                onClick={() => setSendModalLetter(letter)}
                                disabled={!letter.body}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--hse-blue)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--hse-blue-mid)] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 1L5.5 6.5M11 1l-3.5 10L5.5 6.5 1 5l10-4z" />
                                </svg>
                                Отправить email
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="space-y-6">
        <SectionCard title="Категории шаблонов" subtitle="Быстрый выбор получателя.">
          <div className="flex flex-wrap gap-2">
            {Object.values(RECIPIENT_LABEL).map((category) => (
              <ActionButton key={category} label={category} secondary />
            ))}
          </div>
        </SectionCard>
      </div>

      {sendModalLetter && (
        <SendEmailModal
          open={!!sendModalLetter}
          initialSubject={sendModalLetter.subject || ""}
          body={sendModalLetter.body || ""}
          onClose={() => setSendModalLetter(null)}
          onSent={() => {
            setLetters((current) =>
              current.map((l) =>
                l.id === sendModalLetter.id ? { ...l, status: "sent" } : l
              )
            );
          }}
        />
      )}
    </div>
  );
}
