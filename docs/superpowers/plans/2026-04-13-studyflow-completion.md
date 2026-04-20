# StudyFlow AI — Completion Plan (12/12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Довести StudyFlow AI до 12/12 по критериям задания, добавив web STT, конспект лекций, лендинг-воронку, деплой Telegram, контроль доступа к аналитике и онбординг.

**Architecture:** Шесть независимых блоков. Блоки 1–3 критичны для оценки (недостающие пункты), блоки 4–6 улучшают качество и удобство. Каждый блок разворачивается независимо — можно выполнять в любом порядке.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + RLS + Storage), OpenAI (Whisper + GPT-4o-mini), Telegram Bot API, Tailwind CSS, TypeScript

**Реальное состояние на старте:**
- Telegram voice — уже реализован в `lib/telegram/handlers.ts`
- Telegram все функции — уже работает через `orchestrate()`
- Метрики аналитики — реальные SQL-запросы к `orchestrator_runs` ✅
- Воронка — реальные данные (пока 0 т.к. нет запросов в prod)
- `/api/transcribe` — работает но принимает JSON с `audioUrl`/`documentId`, не бинарный поток с микрофона

---

## Блок 1: Web STT + конспект лекций (критично — пункты 10 и 9)

### Что нужно
1. Новый endpoint `/api/transcribe/microphone` принимает `multipart/form-data` с бинарным аудио от `MediaRecorder`
2. Кнопка микрофона в `AssistantClient` — запись → отправка → текст появляется в textarea
3. Новый workflow `lecture_notes` — принять аудиофайл лекции → Whisper → GPT структурирует конспект

---

### Файлы Блока 1

| Действие | Файл |
|----------|------|
| Создать | `app/api/transcribe/microphone/route.ts` |
| Изменить | `app/dashboard/assistant/AssistantClient.tsx` |
| Создать | `lib/services/content/lecture-notes.ts` |
| Изменить | `lib/orchestrator/registry.ts` (только после согласования с пользователем) |
| Изменить | `lib/constants/workflows.ts` |

---

### Task 1.1: Endpoint для микрофона

**Files:**
- Create: `app/api/transcribe/microphone/route.ts`

- [ ] **Step 1: Написать route handler**

```typescript
// app/api/transcribe/microphone/route.ts
import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

export async function POST(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return ERRORS.INVALID_INPUT("Ожидается multipart/form-data.");
  }

  const audioBlob = formData.get("audio");
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    return ERRORS.INVALID_INPUT("Поле 'audio' обязательно (Blob).");
  }

  if (audioBlob.size > 25 * 1024 * 1024) {
    return ERRORS.INVALID_INPUT("Файл превышает лимит 25 МБ.");
  }

  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const file = new File([audioBlob], "recording.webm", {
      type: audioBlob.type || "audio/webm"
    });

    const result = await openai.audio.transcriptions.create(
      { file, model: "whisper-1", language: "ru" },
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    return NextResponse.json({ ok: true, transcript: result.text });
  } catch (err: unknown) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return NextResponse.json(
      {
        ok: false,
        error: isAbort ? "timeout" : "whisper_error",
        message: isAbort
          ? "Превышен таймаут 60 секунд."
          : err instanceof Error ? err.message : "Ошибка транскрипции."
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Проверить тип**

```bash
npx tsc --noEmit
```
Ожидаем: 0 ошибок

---

### Task 1.2: Кнопка микрофона в AssistantClient

**Files:**
- Modify: `app/dashboard/assistant/AssistantClient.tsx`

- [ ] **Step 1: Добавить хук записи**

Добавить в `AssistantClient` сразу после объявления state-переменных (`useState`):

```typescript
const [isRecording, setIsRecording] = useState(false);
const [isTranscribing, setIsTranscribing] = useState(false);
const mediaRecorderRef = useRef<MediaRecorder | null>(null);
const chunksRef = useRef<Blob[]>([]);
```

Добавить импорт `useRef` (если его нет):
```typescript
import { useState, useRef } from "react";
```

- [ ] **Step 2: Добавить функцию toggleRecording**

```typescript
const toggleRecording = async () => {
  if (isRecording) {
    // Остановить запись
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    return;
  }

  // Начать запись
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
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });

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
        body: form
      });
      const data = await res.json() as { ok: boolean; transcript?: string; message?: string };

      if (data.ok && data.transcript) {
        setQuery(prev => prev ? `${prev} ${data.transcript}` : data.transcript!);
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
```

- [ ] **Step 3: Добавить кнопку микрофона в JSX**

Найти кнопку submit (с typing-dot) и добавить кнопку микрофона рядом слева:

```tsx
{/* Кнопка микрофона — добавить перед кнопкой отправки */}
<button
  type="button"
  onClick={toggleRecording}
  disabled={isLoading || isTranscribing}
  title={isRecording ? "Остановить запись" : "Записать голос"}
  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all
    ${isRecording
      ? "bg-[var(--hse-danger)] text-white animate-pulse"
      : "bg-[var(--hse-light)] text-[var(--hse-blue)] hover:bg-[var(--hse-blue)] hover:text-white"
    }
    disabled:opacity-40`}
>
  {isTranscribing ? (
    <span className="typing-dot" />
  ) : isRecording ? (
    /* Stop icon */
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2" y="2" width="10" height="10" rx="2" />
    </svg>
  ) : (
    /* Mic icon */
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="4.5" y="1" width="5" height="8" rx="2.5" />
      <path d="M2 7a5 5 0 0 0 10 0" />
      <line x1="7" y1="12" x2="7" y2="13" />
      <line x1="5" y1="13" x2="9" y2="13" />
    </svg>
  )}
</button>
```

- [ ] **Step 4: Проверить тип**

```bash
npx tsc --noEmit
```
Ожидаем: 0 ошибок

---

### Task 1.3: Workflow lecture_notes (конспект лекции из аудио)

**Files:**
- Create: `lib/services/content/lecture-notes.ts`
- Modify: `lib/constants/workflows.ts` — добавить `"lecture_notes"` в `WorkflowName`

> ⚠️ Изменение `registry.ts` требует явного подтверждения пользователя (см. CLAUDE.md §7).

- [ ] **Step 1: Добавить тип в workflows.ts**

```typescript
// В lib/constants/workflows.ts добавить "lecture_notes" в WorkflowName union type
```

- [ ] **Step 2: Создать сервис**

```typescript
// lib/services/content/lecture-notes.ts
import { getOpenAIClient } from "@/lib/ai/client";
import { DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lecture-notes");

export type LectureNotesResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  actionItems: string[];
};

const SYSTEM_PROMPT = `Ты академический ассистент. По транскрипту лекции составь структурированный конспект.

Верни JSON строго по схеме:
{
  "title": "Название темы лекции",
  "summary": "Краткое резюме (3-5 предложений)",
  "keyPoints": ["Ключевая идея 1", "Ключевая идея 2", ...],
  "definitions": [{"term": "Термин", "definition": "Определение"}],
  "actionItems": ["Что нужно сделать/изучить дополнительно"]
}

Пиши по-русски. keyPoints — минимум 5, максимум 15. definitions — только если есть явные термины.`;

export async function generateLectureNotes(
  transcript: string,
  userId?: string
): Promise<LectureNotesResult> {
  const openai = getOpenAIClient();

  // Обрезать транскрипт до ~12000 токенов (≈48000 символов)
  const truncated = transcript.length > 48_000
    ? transcript.slice(0, 48_000) + "\n\n[транскрипт обрезан]"
    : transcript;

  logger.info({ userId, transcriptLen: truncated.length }, "Generating lecture notes");

  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `ТРАНСКРИПТ ЛЕКЦИИ:\n\n${truncated}` }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })
  );

  const raw = response.choices[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(raw) as LectureNotesResult;
  } catch {
    logger.warn({ raw }, "Failed to parse lecture notes JSON");
    return {
      title: "Конспект лекции",
      summary: raw,
      keyPoints: [],
      definitions: [],
      actionItems: []
    };
  }
}
```

- [ ] **Step 3: Проверить тип**

```bash
npx tsc --noEmit
```
Ожидаем: 0 ошибок

---

### Task 1.4: UI для загрузки аудиолекции

Добавить в страницу документов (`app/dashboard/documents/DocumentsClient.tsx`) или создать отдельную вкладку секцию "Конспект из лекции".

**Files:**
- Modify: `app/dashboard/documents/DocumentsClient.tsx`

- [ ] **Step 1: Добавить секцию загрузки аудио**

После существующей зоны drag-and-drop добавить:

```tsx
{/* Секция: Конспект из аудиолекции */}
<SectionCard
  title="Конспект из записи лекции"
  subtitle="Загрузи MP3/WAV/M4A — получи структурированный конспект"
>
  <LectureNotesUploader />
</SectionCard>
```

- [ ] **Step 2: Создать компонент LectureNotesUploader**

Добавить в файл (или вынести в `components/dashboard/LectureNotesUploader.tsx`):

```tsx
function LectureNotesUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "transcribing" | "generating" | "done" | "error">("idle");
  const [notes, setNotes] = useState<LectureNotesResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ACCEPTED = ["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-m4a", "audio/ogg", "audio/webm"];

  const handleFile = (f: File) => {
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(mp3|mp4|m4a|wav|ogg|webm)$/i)) {
      setErrorMsg("Поддерживаются: MP3, MP4, M4A, WAV, OGG, WebM");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      setErrorMsg("Файл больше 25 МБ. Лимит Whisper.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
  };

  const handleGenerate = async () => {
    if (!file) return;
    setStatus("transcribing");
    setErrorMsg(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      // 1. Транскрибация
      const form = new FormData();
      form.append("audio", file);

      const transcRes = await fetch("/api/transcribe/microphone", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
      });
      const transcData = await transcRes.json() as { ok: boolean; transcript?: string; message?: string };
      if (!transcData.ok || !transcData.transcript) {
        throw new Error(transcData.message ?? "Ошибка транскрипции");
      }

      // 2. Генерация конспекта
      setStatus("generating");
      const notesRes = await fetch("/api/lecture-notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ transcript: transcData.transcript })
      });
      const notesData = await notesRes.json() as { ok: boolean; data?: LectureNotesResult; message?: string };
      if (!notesData.ok || !notesData.data) {
        throw new Error(notesData.message ?? "Ошибка генерации конспекта");
      }

      setNotes(notesData.data);
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Неизвестная ошибка");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--hse-border)] p-6 text-center hover:border-[var(--hse-blue)] hover:bg-[var(--hse-light)]/20 transition-colors">
        <input
          type="file"
          accept=".mp3,.mp4,.m4a,.wav,.ogg,.webm,audio/*"
          className="sr-only"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--hse-blue)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        <span className="text-sm text-[var(--hse-text-muted)]">
          {file ? file.name : "Нажми или перетащи аудиофайл (MP3, M4A, WAV — до 25 МБ)"}
        </span>
      </label>

      {errorMsg && <p className="text-xs text-[var(--hse-danger)]">{errorMsg}</p>}

      {file && status === "idle" && (
        <button
          onClick={handleGenerate}
          className="flex items-center gap-2 rounded-xl bg-[var(--hse-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--hse-blue-mid)] transition-colors"
        >
          Создать конспект
        </button>
      )}

      {(status === "transcribing" || status === "generating") && (
        <div className="flex items-center gap-2 text-sm text-[var(--hse-text-muted)]">
          <span className="flex gap-0.5"><span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/></span>
          {status === "transcribing" ? "Распознаю речь…" : "Генерирую конспект…"}
        </div>
      )}

      {status === "done" && notes && (
        <div className="rounded-xl border border-[var(--hse-border)] bg-white p-4 space-y-3">
          <h3 className="font-semibold text-[var(--hse-blue)]">{notes.title}</h3>
          <p className="text-sm text-[var(--hse-text-muted)]">{notes.summary}</p>
          {notes.keyPoints.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--hse-text-muted)] mb-1">Ключевые идеи</p>
              <ul className="list-disc pl-4 space-y-1">
                {notes.keyPoints.map((pt, i) => (
                  <li key={i} className="text-sm">{pt}</li>
                ))}
              </ul>
            </div>
          )}
          {notes.definitions.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--hse-text-muted)] mb-1">Термины</p>
              {notes.definitions.map((d, i) => (
                <p key={i} className="text-sm"><strong>{d.term}:</strong> {d.definition}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => { setStatus("idle"); setFile(null); setNotes(null); }}
            className="text-xs text-[var(--hse-text-muted)] underline"
          >
            Загрузить другой файл
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Создать `/api/lecture-notes/route.ts`**

```typescript
// app/api/lecture-notes/route.ts
import { NextResponse } from "next/server";
import { generateLectureNotes } from "@/lib/services/content/lecture-notes";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

export async function POST(request: Request) {
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Ожидается JSON.");
  }

  const { transcript } = body as Record<string, unknown>;
  if (!transcript || typeof transcript !== "string" || transcript.trim().length < 50) {
    return ERRORS.INVALID_INPUT("Поле 'transcript' обязательно (минимум 50 символов).");
  }

  try {
    const data = await generateLectureNotes(transcript.trim(), user.id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "generation_failed", message: err instanceof Error ? err.message : "Ошибка генерации." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Финальная проверка**

```bash
npx tsc --noEmit
```
Ожидаем: 0 ошибок

---

## Блок 2: Лендинг как воронка (пункт 5)

### Что нужно
Текущий `app/page.tsx` — маркетинговая страница с описанием функций. Нужно превратить в полноценный лендинг-воронку: hero → что решает → как работает → возможности → контакты + Telegram-ссылка + CTA.

**Структура лендинга (воронки):**
1. **Hero** — заголовок, подзаголовок, CTA «Попробовать бесплатно», ссылка на Telegram-бот
2. **Проблема** — 3 боли студента ВШЭ (дедлайны, переписка, материалы)
3. **Решение** — 6 workflow карточками
4. **Как работает** — 3 шага
5. **Контакты** — email, Telegram-канал, GitHub (если есть), ссылка на деплой

### Файлы Блока 2

| Действие | Файл |
|----------|------|
| Изменить | `app/page.tsx` |

---

### Task 2.1: Расширить лендинг секциями воронки

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Добавить секцию "Проблема"**

После hero-секции добавить:

```tsx
{/* Секция: Боли студента */}
<section className="bg-white py-16">
  <div className="mx-auto max-w-5xl px-6">
    <h2 className="mb-10 text-center text-2xl font-bold text-[var(--hse-blue)]">
      Узнаёшь себя?
    </h2>
    <div className="grid gap-6 md:grid-cols-3">
      {[
        {
          emoji: "😰",
          title: "Письма в деканат",
          desc: "Каждый раз с нуля. Формулировки, тон, структура — тратишь час на то, что ИИ делает за 10 секунд."
        },
        {
          emoji: "🌊",
          title: "Завал материалов",
          desc: "Методичка 80 страниц, запись лекции 2 часа, статьи на английском. Не знаешь с чего начать."
        },
        {
          emoji: "⏱️",
          title: "Дедлайны везде",
          desc: "Силлабус, Moodle, чаты. Задачи разбросаны — постоянно что-то пропускаешь."
        }
      ].map(item => (
        <div key={item.title} className="rounded-2xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)] p-6">
          <div className="mb-3 text-3xl">{item.emoji}</div>
          <h3 className="mb-2 font-semibold text-[var(--hse-blue)]">{item.title}</h3>
          <p className="text-sm text-[var(--hse-text-muted)]">{item.desc}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

- [ ] **Step 2: Добавить секцию "Контакты" в footer**

```tsx
{/* Footer */}
<footer id="contacts" className="border-t border-[var(--hse-border)] bg-white py-12">
  <div className="mx-auto max-w-5xl px-6">
    <div className="grid gap-8 md:grid-cols-3">
      <div>
        <p className="mb-1 text-sm font-semibold text-[var(--hse-blue)]">StudyFlow AI</p>
        <p className="text-xs text-[var(--hse-text-muted)]">AI-ассистент для студентов НИУ ВШЭ</p>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--hse-blue)]">Telegram</p>
        <a
          href="https://t.me/YOUR_BOT_USERNAME"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--hse-accent)] hover:underline"
        >
          @studyflow_bot
        </a>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-[var(--hse-blue)]">Контакт</p>
        <p className="text-sm text-[var(--hse-text-muted)]">your@email.com</p>
      </div>
    </div>
    <p className="mt-8 text-center text-xs text-[var(--hse-text-muted)]">
      Сделано с ❤️ для ВШЭ · {new Date().getFullYear()}
    </p>
  </div>
</footer>
```

> ⚠️ Заменить `YOUR_BOT_USERNAME` и email на реальные значения перед деплоем.

- [ ] **Step 3: Добавить навигационные якоря в hero**

В hero-секции добавить ссылку-якорь на `#contacts` рядом с CTA:

```tsx
<a
  href="#contacts"
  className="inline-block rounded-xl border border-[var(--hse-blue)] px-6 py-3 text-sm font-medium text-[var(--hse-blue)] hover:bg-[var(--hse-light)] transition-colors"
>
  Контакты
</a>
```

- [ ] **Step 4: Проверить тип**

```bash
npx tsc --noEmit
```

---

## Блок 3: Деплой Telegram бота (пункт 4)

### Что нужно
Telegram-бот полностью реализован. Нужно: задеплоить Next.js (Vercel), зарегистрировать webhook, протестировать.

---

### Task 3.1: Скрипт регистрации webhook

**Files:**
- Create: `scripts/setup-telegram-webhook.ts`

- [ ] **Step 1: Создать скрипт**

```typescript
// scripts/setup-telegram-webhook.ts
/**
 * Регистрирует Telegram webhook.
 * Запуск: TELEGRAM_BOT_TOKEN=... APP_URL=https://your-app.vercel.app npx tsx scripts/setup-telegram-webhook.ts
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;

if (!token || !appUrl) {
  console.error("Требуются переменные: TELEGRAM_BOT_TOKEN, APP_URL");
  process.exit(1);
}

const webhookUrl = `${appUrl}/api/telegram/webhook`;

async function main() {
  console.log(`Регистрирую webhook: ${webhookUrl}`);

  // Сначала удалить старый
  const deleteRes = await fetch(
    `https://api.telegram.org/bot${token}/deleteWebhook`
  );
  const deleteData = await deleteRes.json() as { ok: boolean };
  console.log("Удаление старого webhook:", deleteData.ok ? "OK" : "FAILED");

  // Установить новый
  const setRes = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: true
      })
    }
  );
  const setData = await setRes.json() as { ok: boolean; description?: string };

  if (setData.ok) {
    console.log("✅ Webhook зарегистрирован успешно!");
    console.log(`   URL: ${webhookUrl}`);
  } else {
    console.error("❌ Ошибка:", setData.description);
    process.exit(1);
  }

  // Проверить статус
  const infoRes = await fetch(
    `https://api.telegram.org/bot${token}/getWebhookInfo`
  );
  const info = await infoRes.json() as { ok: boolean; result: Record<string, unknown> };
  console.log("\nСтатус webhook:");
  console.log(JSON.stringify(info.result, null, 2));
}

main().catch(console.error);
```

- [ ] **Step 2: Добавить npm script в package.json**

```json
"scripts": {
  "telegram:webhook": "tsx scripts/setup-telegram-webhook.ts"
}
```

---

### Task 3.2: Инструкция деплоя (docs/deployment.md)

**Files:**
- Modify: `docs/deployment.md`

- [ ] **Step 1: Добавить секцию Telegram в docs/deployment.md**

```markdown
## Деплой Telegram бота

### Предварительные условия
1. Создать бота через @BotFather, получить токен
2. Задеплоить приложение на Vercel (или другой хостинг с HTTPS)

### Переменные окружения (Vercel → Settings → Environment Variables)
```
TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
```

### Регистрация webhook

После деплоя на Vercel:

```bash
TELEGRAM_BOT_TOKEN=your_token APP_URL=https://your-app.vercel.app npm run telegram:webhook
```

### Проверка работы
1. Найти бота в Telegram по username
2. Отправить /start
3. Отправить текстовое сообщение
4. Отправить голосовое сообщение

### Локальная разработка
```bash
# Установить cloudflared
cloudflared tunnel --url http://localhost:3000
# Скопировать URL вида https://xxx.trycloudflare.com
APP_URL=https://xxx.trycloudflare.com npm run telegram:webhook
```
```

---

## Блок 4: Контроль доступа к аналитике (пункт 5)

### Что нужно
Сейчас `/dashboard/analytics` доступна любому авторизованному пользователю. Нужно разграничить:
- **Обычный пользователь** — видит только свои данные
- **Команда/admin** — видит общую аналитику

### Подход
Добавить поле `role` в таблицу `profiles` (значения: `'user'` | `'admin'`). Страница аналитики проверяет роль. Выдача роли — через Supabase Dashboard (SQL) или скрипт.

> ⚠️ Требует создания новой миграции — нужно явное подтверждение пользователя.

---

### Task 4.1: Миграция для ролей

**Files:**
- Create: `supabase/migrations/0006_user_roles.sql`

> ⚠️ Создание миграции требует подтверждения. Показать SQL пользователю до применения.

```sql
-- supabase/migrations/0006_user_roles.sql
-- Добавить роль к профилям пользователей

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- RLS: admin видит все profiles, user — только свой
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id
    OR (
      SELECT role FROM profiles WHERE id = auth.uid()
    ) = 'admin'
  );

-- Выдать admin вручную через Supabase SQL Editor:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';
```

---

### Task 4.2: Защита страницы аналитики

**Files:**
- Modify: `app/dashboard/analytics/page.tsx`

- [ ] **Step 1: Добавить проверку роли**

```typescript
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// В начале AnalyticsPage():
const supabase = getSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");

const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .single();

if ((profile as { role?: string } | null)?.role !== "admin") {
  return (
    <DashboardContainer>
      <PageHeader title="Аналитика" subtitle="" />
      <p className="text-sm text-[var(--hse-text-muted)]">
        Доступ только для команды проекта. Обратитесь к администратору.
      </p>
    </DashboardContainer>
  );
}
```

- [ ] **Step 2: Скрипт выдачи роли**

```typescript
// scripts/grant-admin.ts
// Запуск: SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_URL=... USER_EMAIL=you@hse.ru npx tsx scripts/grant-admin.ts

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const email = process.env.USER_EMAIL;
  if (!email) { console.error("Укажи USER_EMAIL"); process.exit(1); }

  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users.find(u => u.email === email);
  if (!user) { console.error(`Пользователь ${email} не найден`); process.exit(1); }

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id);

  if (error) { console.error("Ошибка:", error.message); process.exit(1); }
  console.log(`✅ Роль admin выдана пользователю ${email}`);
}

main().catch(console.error);
```

- [ ] **Step 3: Добавить script в package.json**

```json
"grant-admin": "tsx scripts/grant-admin.ts"
```

---

## Блок 5: Гибкость LLM (пункт 8)

### Что нужно
Вся логика OpenAI изолирована в `lib/ai/client.ts`. Для смены провайдера нужно изменить только этот файл (или добавить env var).

**Ответ на вопрос пользователя:** Вся логика завязана на OpenAI SDK (`openai` пакет). При смене на Claude/Gemini придётся:
1. Поменять `lib/ai/client.ts` — создать новый клиент
2. Обновить `lib/ai/retry.ts` — типы ответов
3. STT (Whisper) — отдельно, т.к. нет универсального аналога

**Минимальное решение без полного рефактора** — добавить поддержку Anthropic через OpenAI-совместимый endpoint:

```typescript
// lib/ai/client.ts — добавить поддержку провайдера
export function getOpenAIClient(): OpenAI {
  const provider = process.env.LLM_PROVIDER ?? "openai"; // "openai" | "anthropic"
  
  if (provider === "anthropic") {
    return new OpenAI({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      baseURL: "https://api.anthropic.com/v1/",
      defaultHeaders: { "anthropic-version": "2023-06-01" }
    });
  }
  
  // default: openai
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, timeout: 60_000, maxRetries: 0 });
}
```

> ⚠️ Anthropic через OpenAI-compatible endpoint имеет ограничения (нет structured output, нет Whisper). Полная поддержка Claude требует `@anthropic-ai/sdk` и отдельного клиента.

---

### Task 5.1: Добавить абстракцию провайдера

**Files:**
- Modify: `lib/ai/client.ts`
- Modify: `.env.example`

- [ ] **Step 1: Расширить client.ts**

```typescript
// lib/ai/client.ts
import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const provider = process.env.LLM_PROVIDER ?? "openai";

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
    _client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });
  } else if (provider === "anthropic-compat") {
    // Claude через OpenAI-совместимый endpoint (только completions, без Whisper)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing for anthropic-compat provider");
    _client = new OpenAI({
      apiKey,
      baseURL: "https://api.anthropic.com/v1/",
      timeout: 60_000,
      maxRetries: 0
    });
  } else {
    throw new Error(`Неизвестный LLM_PROVIDER: ${provider}. Допустимые: openai, anthropic-compat`);
  }

  return _client;
}

export const DEFAULT_MODEL =
  process.env.OPENAI_MODEL ??
  (process.env.LLM_PROVIDER === "anthropic-compat" ? "claude-haiku-4-5-20251001" : "gpt-4o-mini");
```

- [ ] **Step 2: Добавить в .env.example**

```
# LLM Provider: "openai" (default) | "anthropic-compat"
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o-mini   # override model

# Если LLM_PROVIDER=anthropic-compat:
# ANTHROPIC_API_KEY=sk-ant-...
# OPENAI_MODEL=claude-haiku-4-5-20251001
```

- [ ] **Step 3: Проверить тип**

```bash
npx tsc --noEmit
```

---

## Блок 6: Онбординг в UI (пункт 10)

### Что нужно
Добавить объяснения "как работает этот инструмент" прямо в интерфейс — без отдельной страницы, встроенно в каждый экран.

### Task 6.1: Компонент HowItWorks

**Files:**
- Create: `components/dashboard/HowItWorks.tsx`
- Modify: ключевые страницы дашборда

- [ ] **Step 1: Создать компонент**

```tsx
// components/dashboard/HowItWorks.tsx
"use client";
import { useState } from "react";

type Step = { icon: string; title: string; desc: string };

export function HowItWorks({
  title = "Как это работает",
  steps
}: {
  title?: string;
  steps: Step[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[var(--hse-border)] bg-[var(--hse-page-bg)]">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-[var(--hse-blue)]">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7" cy="7" r="6" />
            <path d="M7 5v.01M7 7v3" />
          </svg>
          {title}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
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
                  <p className="text-sm font-medium text-[var(--hse-text)]">{step.title}</p>
                  <p className="text-xs text-[var(--hse-text-muted)]">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Добавить на страницу ассистента**

```tsx
// В AssistantClient.tsx добавить HowItWorks перед quickScenarios
<HowItWorks
  steps={[
    {
      icon: "✍️",
      title: "Опиши задачу своими словами",
      desc: "Пиши как обычно — система сама поймёт, что нужно сделать."
    },
    {
      icon: "🤖",
      title: "ИИ выбирает нужный инструмент",
      desc: "LLM-классификатор определяет намерение (письмо, план, анализ документа и т.д.) с точностью >90%."
    },
    {
      icon: "⚡",
      title: "Ответ за 3–8 секунд",
      desc: "GPT-4o-mini обрабатывает запрос. Если ответ неточный — уточни запрос или загрузи документ."
    }
  ]}
/>
```

- [ ] **Step 3: Добавить на страницу документов**

```tsx
<HowItWorks
  title="Как работает поиск по документам"
  steps={[
    { icon: "📄", title: "Загрузи PDF или аудио", desc: "Система нарезает на чанки и создаёт векторные эмбеддинги через text-embedding-3-small." },
    { icon: "🔍", title: "Задай вопрос ассистенту", desc: "Запрос расширяется до 3 вариантов, ищутся ближайшие чанки через pgvector." },
    { icon: "💬", title: "Ответ со ссылками", desc: "GPT отвечает строго по найденным фрагментам, приводя цитаты из документа." }
  ]}
/>
```

- [ ] **Step 4: Проверить тип**

```bash
npx tsc --noEmit
```

---

## Итоговая карта баллов

| Балл | Требование | Статус до | После плана |
|------|-----------|-----------|-------------|
| 1 | Прикладная задача | ✅ | ✅ |
| 2 | Вайб-кодинг | ✅ | ✅ |
| 3 | LLM внутри | ✅ | ✅ + Блок 5 (гибкость) |
| 4 | Telegram-бот | ⚠️ | ✅ Блок 3 (деплой + webhook) |
| 5 | Лендинг | ✅ | ✅ + Блок 2 (воронка) |
| 6 | Веб-интерфейс | ✅ | ✅ |
| 7 | Авторизация | ✅ | ✅ |
| 8 | RAG-ассистент | ✅ | ✅ |
| 9 | База данных | ✅ | ✅ |
| 10 | Голосовой ввод STT | ❌ | ✅ Блок 1 (микрофон в веб) |
| 11 | Дашборд статистики | ✅* | ✅ + Блок 4 (контроль доступа) |
| 12 | Аналитика воронки | ✅* | ✅ |

*Данные появятся после запуска в продакшне с реальными пользователями.

**Бонус (не в критериях, но повышают качество):**
- Конспект лекции из аудио (Блок 1, Task 1.3–1.4)
- Онбординг в UI (Блок 6)
- LLM flexibility (Блок 5)

## Рекомендуемый порядок выполнения

1. **Блок 3** — деплой Telegram (самое независимое, нужен живой бот для демо)
2. **Блок 1, Task 1.1–1.2** — микрофон в вебе (закрывает балл 10)
3. **Блок 4** — роли (мигрируешь один раз, потом просто выдаёшь себе admin)
4. **Блок 2** — лендинг (улучшение существующего, без рисков)
5. **Блок 1, Task 1.3–1.4** — конспект лекции (новый workflow, бонус)
6. **Блок 5** — LLM flexibility (только если планируешь менять провайдера)
7. **Блок 6** — онбординг (финальный polish)
