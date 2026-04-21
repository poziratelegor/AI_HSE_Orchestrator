"use client";

import { useState, useRef, useEffect } from "react";
import { SectionCard, InlineAlert } from "@/components/dashboard/ui";
import { HowItWorks } from "@/components/dashboard/HowItWorks";
import { WorkflowPicker } from "@/components/dashboard/WorkflowPicker";
import { Markdown } from "@/components/dashboard/Markdown";
import { ResultBlock } from "@/components/dashboard/ResultBlock";
import type { CitationSource } from "@/components/dashboard/Citation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { normalizeOrchestrateResult } from "@/lib/orchestrator/normalize-result";
import { RecentPromptsPanel, type RecentPrompt } from "@/components/dashboard/RecentPromptsPanel";

const quickScenarios = [
  "Подготовить официальное письмо",
  "Суммаризировать документ",
  "Составить учебный план",
  "Разбить цель на задачи"
];

const examples = [
  "Составь вежливое письмо преподавателю о консультации на следующей неделе.",
  "Выдели ключевые тезисы из методички по статистике.",
  "Собери план подготовки к экзамену за 10 дней."
];

/** Three-dot typing animation indicator */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] px-4 py-3 animate-fade-in">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hse-light)]" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1C2.8 1 1 2.6 1 4.6c0 .8.3 1.6.8 2.2L1.5 9l1.8-.6c.5.2 1.1.3 1.7.3 2.2 0 4-1.6 4-3.6S7.2 1 5 1Z" fill="var(--hse-blue)" opacity="0.7"/>
        </svg>
      </span>
      <span className="text-xs text-[var(--hse-text-muted)]">Анализирую запрос</span>
      <span className="flex items-center gap-0.5 text-slate-400" aria-hidden="true">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
    </div>
  );
}

export default function AssistantClient() {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showWorkflowPicker, setShowWorkflowPicker] = useState(false);
  const [clarificationQuestion, setClarificationQuestion] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState<string>("");
  const [streamCitations, setStreamCitations] = useState<CitationSource[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<RecentPrompt[]>([]);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        const data = (await res.json()) as {
          ok: boolean;
          transcript?: string;
          message?: string;
        };

        if (data.ok && data.transcript) {
          // Для голосового UX заменяем поле целиком:
          // это снижает риск «склейки» со старым текстом и неверной маршрутизации.
          setQuery(data.transcript);
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

  const handleSubmit = async (overrideQuery?: string) => {
    const text = (overrideQuery ?? query).trim();
    if (!text) return;
    const optimisticId = `optimistic-${Date.now()}`;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setStreamedText("");
    setStreamCitations([]);
    setShowWorkflowPicker(false);
    setRecentPrompts((prev) => [{ id: optimisticId, text, status: "В обработке", optimistic: true }, ...prev].slice(0, 5));

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/orchestrate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ text, channel: "web" })
      });

      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        const msg =
          typeof (payload as { message?: unknown }).message === "string"
            ? (payload as { message: string }).message
            : "Не удалось обработать запрос.";
        setError(msg);
        toast.error(msg);
        return;
      }

      const data = payload as {
        ok?: boolean;
        intent?: string;
        needsClarification?: boolean;
        clarificationQuestion?: string;
        result?: unknown;
      };

      if (data.needsClarification || data.intent === "route_recommender") {
        setClarificationQuestion(data.clarificationQuestion ?? null);
        setShowWorkflowPicker(true);
        setResult(null);
        setRecentPrompts((prev) => prev.map((item) => (item.id === optimisticId ? { ...item, status: "Готово" } : item)));
        return;
      }

      setShowWorkflowPicker(false);

      // RAG ответ — переключаемся на streaming
      if (data.intent === "rag_qa") {
        setResult(null);
        void streamRagAnswer(text, optimisticId);
      } else {
        setResult(payload);
        setRecentPrompts((prev) =>
          prev.map((item) => (item.id === optimisticId ? { ...item, status: "Готово", optimistic: false } : item))
        );
        toast.success("Запрос обработан успешно");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Сетевая ошибка.";
      setError(msg);
      setRecentPrompts((prev) =>
        prev.map((item) => (item.id === optimisticId ? { ...item, status: "Ошибка", optimistic: false } : item))
      );
      toast.error(msg);
    } finally {
      setIsLoading(false);
      setHistoryRefreshToken((prev) => prev + 1);
    }
  };

  const streamRagAnswer = async (question: string, optimisticId: string) => {
    setIsStreaming(true);
    setStreamedText("");
    setStreamCitations([]);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch("/api/rag/query/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ query: question })
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        setError(`Stream error: ${text || response.status}`);
        toast.error("Не удалось получить ответ от RAG");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // keep incomplete line for next iteration

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed) as
              | { delta: string }
              | { done: true; citations: CitationSource[] }
              | { error: string };

            if ("delta" in event) {
              setStreamedText((prev) => prev + event.delta);
            } else if ("done" in event) {
              setStreamCitations(event.citations);
            } else if ("error" in event) {
              setError(event.error);
              toast.error(event.error);
            }
          } catch {
            // Malformed line — skip
          }
        }
      }

      toast.success("Ответ готов");
      setRecentPrompts((prev) =>
        prev.map((item) => (item.id === optimisticId ? { ...item, status: "Готово", optimistic: false } : item))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Сетевая ошибка";
      setError(msg);
      setRecentPrompts((prev) =>
        prev.map((item) => (item.id === optimisticId ? { ...item, status: "Ошибка", optimistic: false } : item))
      );
      toast.error(msg);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleWorkflowSelect = (workflowId: string, originalQuery: string) => {
    const prefixedQuery = `[${workflowId}] ${originalQuery}`;
    setShowWorkflowPicker(false);
    setQuery(prefixedQuery);
    void handleSubmit(prefixedQuery);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="animate-slide-up">
          <SectionCard title="Новый запрос" subtitle="Сформулируйте задачу в свободной форме.">
            <div className="rounded-2xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] p-4 transition-colors focus-within:border-[var(--hse-blue)]/30 focus-within:bg-white">
              <textarea
                className="h-32 w-full resize-none bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                placeholder="Например: помоги подготовить письмо о переносе дедлайна с формальным тоном и краткой аргументацией."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && query.trim() && !isLoading) {
                    e.preventDefault();
                    void handleSubmit(undefined);
                  }
                }}
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {query.length > 0 ? `${query.length} симв. · ` : ""}
                  Ctrl+Enter для отправки
                </span>
                <div className="flex items-center gap-2">
                  {/* Микрофон */}
                  <button
                    type="button"
                    onClick={() => void toggleRecording()}
                    disabled={isLoading || isTranscribing}
                    title={isRecording ? "Остановить запись" : "Записать голос"}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150
                      ${isRecording
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
                  {/* Отправить */}
                  <button
                    disabled={isLoading || !query.trim()}
                    onClick={() => void handleSubmit(undefined)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white transition-all duration-150 hover:bg-[var(--hse-blue-mid)] hover:-translate-y-px active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <span className="inline-flex items-center gap-0.5">
                          <span className="typing-dot bg-white/80" />
                          <span className="typing-dot bg-white/80" />
                          <span className="typing-dot bg-white/80" />
                        </span>
                        <span className="sr-only">Формирую ответ</span>
                      </>
                    ) : "Отправить"}
                  </button>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                🎙️ Длинные аудио (до 5 минут) могут обрабатываться 30–60 секунд.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {quickScenarios.map((item, i) => (
                <button
                  key={item}
                  onClick={() => setQuery(item)}
                  className="animate-fade-in inline-flex items-center rounded-xl border border-[var(--hse-border)] bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-all duration-150 hover:border-[var(--hse-blue)]/30 hover:bg-[var(--hse-light)] hover:text-[var(--hse-blue)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(55,75,155,0.3)]"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {item}
                </button>
              ))}
            </div>

            {/* Typing indicator while loading */}
            {isLoading && (
              <div className="mt-4">
                <TypingIndicator />
              </div>
            )}

            {/* Error */}
            {error && !isLoading && (
              <div className="mt-4 animate-fade-in">
                <InlineAlert message={error} tone="danger" />
              </div>
            )}

            {/* Workflow picker — shown when AI is unsure or returns route_recommender */}
            {showWorkflowPicker && !isLoading && (
              <div className="mt-4 animate-fade-in">
                <WorkflowPicker
                  question={clarificationQuestion ?? "Уточни, что тебе нужно:"}
                  originalQuery={query}
                  onSelect={handleWorkflowSelect}
                />
              </div>
            )}

            {/* Streaming RAG answer */}
            {(isStreaming || streamedText) && !error && (
              <div className="mt-4 animate-fade-in-scale rounded-2xl border border-[var(--hse-blue)]/20 bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--hse-light)]" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="var(--hse-blue)" strokeWidth="1.4" />
                      <path d="M4 6h4M6 4v4" stroke="var(--hse-blue)" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--hse-blue)]">Ответ по документам</p>
                  {isStreaming && (
                    <span className="inline-flex gap-0.5" aria-label="Стрим">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  )}
                </div>
                <Markdown content={streamedText} sources={streamCitations} />
                {!isStreaming && streamCitations.length > 0 && (
                  <div className="mt-4 border-t border-[var(--hse-border)] pt-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--hse-text-muted)]">Источники</p>
                    <ol className="space-y-1.5 text-xs text-slate-600">
                      {streamCitations.map((c) => (
                        <li key={c.index}>
                          <span className="font-medium text-[var(--hse-blue)]">[{c.index}]</span>{" "}
                          {c.documentTitle && <span className="font-medium">{c.documentTitle}</span>}
                          {c.documentTitle && " — "}
                          <span className="text-[var(--hse-text-muted)]">{c.excerpt}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* Result */}
            {result !== null && !error && !isLoading && (() => {
              const view = normalizeOrchestrateResult(result);
              if (!view.text) return null;
              return (
                <div className="mt-4">
                  <ResultBlock
                    title={view.title ?? "Результат"}
                    text={view.text}
                    meta={
                      view.subtitle ? (
                        <p className="text-sm font-medium text-slate-700">{view.subtitle}</p>
                      ) : undefined
                    }
                  />
                </div>
              );
            })()}
          </SectionCard>
        </div>

        <div className="animate-slide-up delay-100">
          <SectionCard title="Примеры запросов" subtitle="Подсказки для быстрого старта.">
            <ul className="space-y-3">
              {examples.map((example, i) => (
                <li
                  key={example}
                  className="animate-fade-in cursor-pointer rounded-xl border border-[var(--hse-border)] px-4 py-3 text-sm text-slate-700 transition-all duration-200 hover:border-[var(--hse-blue)]/25 hover:bg-[var(--hse-light)]/40 hover:-translate-y-px hover:text-slate-900"
                  style={{ animationDelay: `${100 + i * 80}ms` }}
                  onClick={() => setQuery(example)}
                >
                  <span className="mr-2 text-[var(--hse-blue)]/40">→</span>
                  {example}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>

        <div className="animate-slide-up delay-200">
          <HowItWorks
            steps={[
              { title: "Опиши задачу своими словами", desc: "Пиши как обычно — система сама поймёт, что нужно сделать. Или нажми кнопку микрофона для голосового ввода." },
              { title: "ИИ выбирает нужный инструмент", desc: "LLM-классификатор определяет намерение (письмо, план, анализ документа и т.д.) с точностью >90%." },
              { title: "Ответ за 3–8 секунд", desc: "GPT обрабатывает запрос. Если ответ неточный — уточни формулировку или загрузи документ в разделе «Документы»." },
            ]}
          />
        </div>
      </div>

      <div className="animate-slide-in-right delay-150">
        <RecentPromptsPanel
          optimisticPrompts={recentPrompts}
          refreshToken={historyRefreshToken}
          onPromptSelect={setQuery}
        />
      </div>
    </div>
  );
}
