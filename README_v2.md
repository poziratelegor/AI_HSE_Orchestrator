# StudyFlow AI

> AI-оркестратор для студентов: лекции, документы, дедлайны, письма и учебные сценарии — одна точка входа на естественном языке.

![Next.js](https://img.shields.io/badge/Next.js-16.x-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-postgres%20%2B%20pgvector-green?logo=supabase)
![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o-412991?logo=openai)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)

---

## Что это

Пользователь формулирует задачу в свободной форме — в веб-интерфейсе или Telegram.
Система определяет намерение (intent), выбирает подходящий workflow и возвращает результат.

Это **starter-kit**: архитектура, документация и оркестратор готовы. Сервисные функции в `lib/services/*` — заглушки, которые нужно реализовать.

**Главный документ проекта:** [`product.md`](./product.md) — продуктовые цели, NFR, lifecycle запроса, статус реализации по слоям и архитектурные инварианты. Читать первым.

---

## Статус проекта

| Часть | Статус |
|-------|--------|
| Оркестратор (registry, classify, router, executor) | ✅ scaffold — rules-based, работает |
| Supabase client (browser + server) | ✅ работает |
| OpenAI client | ✅ работает |
| OpenAI prompts + schemas | ✅ определены — не подключены к сервисам |
| Supabase middleware (auth guard) | ⚙️ заглушка |
| Route handlers (`/api/*`) | ⚠️ scaffold — нет auth, нет валидации |
| Upload (`/api/upload`) | ⚙️ заглушка — нет файловой обработки, нет Supabase |
| Telegram webhook (верификация) | ⚠️ верифицирует secret token, handleTelegramUpdate не вызван |
| Telegram bot + handlers | ⚙️ заглушки |
| Сервисы `lib/services/*` | ⚙️ заглушки — нужна реализация |
| RAG chunk | ⚠️ базовая реализация — без overlap |
| RAG embed, retrieve, citations | ⚙️ заглушки |
| LLM-классификация | ⚙️ не подключена (schema и промпт готовы в `lib/openai/`) |
| Аналитика (`lib/analytics/*`) | ⚙️ заглушки — не пишут в БД |
| БД миграция | ✅ готово |
| RLS политики | ⚙️ только TODO-комментарий в `supabase/policies.sql` |
| UI компоненты (`/components`) | ⚙️ пустые директории |
| Dashboard pages | ⚙️ структура без реализации |
| Тесты | ⚙️ директории пустые |

---

## Требования к окружению

- Node.js >= 20.x
- npm >= 10.x
- Аккаунт [Supabase](https://supabase.com)
- Аккаунт [OpenAI](https://platform.openai.com) с доступом к `gpt-4o` и `text-embedding-3-small`
- Telegram Bot Token (опционально, для bot-канала)

---

## Быстрый старт

### 1. Установка

```bash
cd studyflow-ai-starter
npm install
```

### 2. Supabase

1. Создай проект на [supabase.com](https://supabase.com)
2. Перейди в **Database → Extensions** → включи `vector` (pgvector)
3. Выполни миграцию через SQL Editor или CLI:

```bash
# Через CLI
npx supabase db push

# Или вручную: скопируй содержимое supabase/migrations/0001_init.sql в SQL Editor
```

4. Применить RLS политики: `supabase/policies.sql` → SQL Editor
   *(сейчас файл содержит только TODO — политики нужно написать)*

### 3. Переменные окружения

```bash
cp .env.example .env.local
```

Заполни `.env.local`. Обязательные переменные:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # только сервер
OPENAI_API_KEY=sk-...              # только сервер
TELEGRAM_BOT_TOKEN=                # опционально
TELEGRAM_WEBHOOK_SECRET=           # опционально
```

Дополнительно в `.env.local` (не в `.env.example`):

```env
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ORCHESTRATOR_CONFIDENCE_THRESHOLD=0.45
RAG_CHUNK_SIZE=512
RAG_CHUNK_OVERLAP=64
RAG_TOP_K=5
MAX_UPLOAD_SIZE_MB=20
INPUT_TEXT_RETENTION_DAYS=90
```

### 4. Запуск

```bash
npm run dev
# -> http://localhost:3000
```

---

## Команды разработки

```bash
npm run dev          # next dev --turbopack -> localhost:3000
npm run build        # проверка перед деплоем
npm run lint         # линтинг
npx tsc --noEmit     # проверка типов (запускай после изменений в lib/*)

# Telegram tunnel для локальной разработки
cloudflared tunnel --url http://localhost:3000

# БД (если есть Supabase CLI)
npx supabase db push

# Скрипты
npx tsx scripts/seed.ts
npx tsx scripts/ingest-documents.ts
```

---

## Архитектура репозитория

```
lib/orchestrator/
  registry.ts    <- единственное место описания workflow
  classify.ts    <- keyword matching, classifyIntent()
  router.ts      <- точка входа: orchestrate(input)
  executor.ts    <- вызов workflow.run()
  fallback.ts    <- buildFallbackResponse()
  policies.ts    <- ORCHESTRATOR_THRESHOLDS {execute: 0.75, recommend: 0.45}

lib/services/       <- один файл = один workflow (все заглушки)
lib/rag/            <- chunk (базовый), embed/retrieve/citations (заглушки)
lib/openai/         <- client (готов), prompts/schemas (готовы, не подключены)
lib/supabase/       <- client/server (готовы), middleware (заглушка)
lib/telegram/       <- bot/handlers (заглушки)
lib/analytics/      <- events/funnel/metrics (заглушки)
lib/constants/      -> workflows.ts — единый источник ID workflow

app/api/            <- route handlers (scaffold без auth/валидации)
app/dashboard/      <- страницы дашборда (структура без реализации)
components/         <- пустые директории
supabase/           <- migrations (готово), policies (TODO), seed
docs/               <- architecture, api, database, deployment, roadmap, ADR
scripts/            <- ingest-documents, seed, backfill-analytics
tests/              <- пустые директории
```

**Flow оркестратора:**

```
POST /api/orchestrate
  -> router.ts orchestrate()
    -> classify.ts classifyIntent()  [rules-based keyword matching]
    -> policies.ts ORCHESTRATOR_THRESHOLDS
    -> executor.ts executeWorkflow()
      -> registry.ts workflow.run()
        -> lib/services/{workflow}.ts
```

---

## Локальная разработка с Telegram

Telegram требует публичный HTTPS URL:

```bash
# Запусти тоннель
cloudflared tunnel --url http://localhost:3000
# -> https://xxxx.trycloudflare.com

# Зарегистрируй webhook
curl https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://xxxx.trycloudflare.com/api/telegram/webhook \
  -d secret_token=$TELEGRAM_WEBHOOK_SECRET
```

Подробнее — в [`docs/deployment.md`](./docs/deployment.md).

---

## Рекомендуемый порядок реализации

1. **RLS политики** — `supabase/policies.sql` — критично для безопасности данных
2. **Auth** — `app/(auth)/login`, `app/(auth)/signup`, реальный Supabase middleware
3. **Auth в route handlers** — добавить auth check и input validation в `app/api/*`
4. **Assistant page** — `app/dashboard/assistant/page.tsx` + базовый input
5. **Первый workflow: `letter_generator`** — реализовать `lib/services/letters.ts` с реальным OpenAI
6. **Upload pipeline** — `/api/upload` с multipart, Supabase documents, background processing
7. **RAG pipeline** — `lib/rag/embed.ts`, `retrieve.ts`, `citations.ts`, затем `/api/rag/query`
8. **Telegram** — `lib/telegram/handlers.ts`, подключить в `webhook/route.ts`
9. **Аналитика** — `lib/analytics/events.ts` → пишем в `analytics_events`
10. **LLM-классификация** — подключить `lib/openai/` к `classify.ts`, доработать `router.ts`

Подробный roadmap — в [`docs/roadmap.md`](./docs/roadmap.md).

---

## Claude Code workflow

Этот проект разрабатывается с расчётом на Claude Code и AI-assisted workflow.
Основной файл правил для агентного режима — [`CLAUDE.md`](./CLAUDE.md).

### Порядок чтения файлов перед задачей

```
product.md -> CLAUDE.md -> README.md -> docs/architecture.md
-> docs/orchestrator.md -> lib/constants/workflows.ts
-> lib/orchestrator/registry.ts -> нужные lib/* файлы
```

Не редактировать файл, не открыв его. Не угадывать содержимое по имени.

### Что можно делать автономно

- Читать любые файлы проекта
- Создавать новые файлы в рамках существующей структуры
- Редактировать заглушки в `lib/services/*` и `lib/rag/*`
- Запускать `npx tsc --noEmit`, `npm run lint`, `npm run build`

### Что требует явного подтверждения

- Изменение схемы БД (создание новых миграций)
- Установка новых npm-пакетов
- Изменение `lib/orchestrator/registry.ts`
- Изменение `lib/orchestrator/policies.ts`
- Изменение `supabase/policies.sql`
- Любые изменения в `app/(auth)/*`
- Редактирование уже применённых миграций

### Никогда без явного разрешения

- `npm install` без обоснования и предложения альтернатив
- Хардкод секретов или API-ключей
- Удаление файлов миграций
- Массовый рефакторинг несвязанных файлов
- Замена `NEXT_PUBLIC_*` на прямые env vars в клиентском коде

### Структурированные ошибки (обязательный паттерн)

```typescript
// Правильно
return NextResponse.json(
  { ok: false, error: "classification_failed", message: "..." },
  { status: 500 }
);

// Неправильно
throw new Error("something went wrong");
```

### Auth check в каждом route handler (цель)

```typescript
const supabase = getSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
```

---

## Архитектурные инварианты (сжато)

1. **Новый workflow = одна запись в `lib/orchestrator/registry.ts`**. Не трогай router, executor, classify.
2. **Бизнес-логика только в `lib/services/*`**. Route handlers: auth → validate → service → JSON.
3. **Секреты только на сервере**. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN` — никогда в клиент.
4. **OpenAI не вызывается из клиентских компонентов**. Только через `/api/*`.
5. **`lib/services/*` вызываемы напрямую** — не зависят от Request/Response.
6. **Telegram webhook всегда отвечает `200 OK`** — даже при ошибке обработки.
7. **Upload не блокирует** — fast response, processing в background.
8. **RLS включён для всех пользовательских таблиц**.

---

## Документация

| Файл | Содержание |
|------|-----------|
| [`product.md`](./product.md) | Продукт, NFR, lifecycle, статус реализации, automation |
| [`docs/architecture.md`](./docs/architecture.md) | Слои системы, принципы |
| [`docs/orchestrator.md`](./docs/orchestrator.md) | Логика маршрутизации, confidence policy |
| [`docs/database.md`](./docs/database.md) | Схема БД, статусы документов |
| [`docs/api.md`](./docs/api.md) | API контракты, примеры запросов |
| [`docs/deployment.md`](./docs/deployment.md) | Vercel, Telegram webhook, env vars |
| [`docs/roadmap.md`](./docs/roadmap.md) | MVP vs Phase 2 vs Phase 3 |
| [`docs/adr/`](./docs/adr/) | Архитектурные решения (ADR) |
| [`CLAUDE.md`](./CLAUDE.md) | Правила для Claude Code и AI-ассистентов |

---

## Стек

| Компонент | Технология |
|-----------|-----------|
| Frontend / API | Next.js 16.x (App Router, Turbopack) |
| Язык | TypeScript 5.x |
| Стили | Tailwind CSS 3.x |
| База данных / Auth | Supabase (Postgres, RLS, Storage) |
| Vector search | pgvector через Supabase |
| AI | OpenAI SDK ^5.20.0, gpt-4o + text-embedding-3-small |
| Bot | Telegram Bot API |
| Деплой | Vercel |
