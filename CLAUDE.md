# CLAUDE.md — StudyFlow AI

> Этот файл — основной контекст проекта для Claude Code.
> Читай его полностью перед любой задачей. Не пропускай разделы.

---

## 1. Что это за проект

**StudyFlow AI** — AI-оркестратор для студентов.
Пользователь описывает задачу на естественном языке → система классифицирует intent → запускает нужный workflow → возвращает результат.

Два канала: веб-интерфейс (Next.js) и Telegram-бот.

**Полный продуктовый контекст:** `product.md` — читай его если нужен контекст о целях, NFR, жизненном цикле запроса, или n8n-стратегии.

---

## 2. Статус проекта

| Слой | Файлы | Статус |
|------|-------|--------|
| Оркестратор (routing, classify, registry) | `lib/orchestrator/*` | ✅ LLM-first + keyword fallback |
| Сервисы (бизнес-логика workflow) | `lib/services/*` | ✅ rag_qa, letters, tasks реализованы; остальные — частично |
| RAG pipeline | `lib/rag/*` | ✅ полностью реализован (embed, retrieve, chunk, expand-query, citations) |
| OpenAI интеграция | `lib/ai/*` | ✅ работает (client, retry, token-guard, prompts, schemas) |
| Supabase клиент | `lib/supabase/*` | ✅ работает |
| Telegram | `lib/telegram/*` | ✅ реализован (text + voice via Whisper + document caption) |
| Аналитика | `lib/analytics/*` | ✅ trackEvent реализован; funnel/metrics — заглушки |
| Интеграции | `lib/integrations/*` | ✅ YouTube, SmartLMS (Moodle HSE), iCal |
| Repository layer | `lib/repository/*` | ✅ auth, documents, letters, tasks |
| Document ingestion | `lib/services/documents/*` | ✅ PDF/audio → chunk → embed → pgvector |
| Route handlers | `app/api/*` | ✅ реализованы; добавлены integrations и document status |
| UI | `components/*`, `app/dashboard/*` | ⚙️ структура без реализации |
| БД миграция | `supabase/migrations/0001_init.sql` | ✅ готово |
| RLS политики | `supabase/policies.sql` | ⚙️ нужна проверка и применение |

**Важно:** классификатор использует **LLM-first стратегию** (`classify-llm.ts`) с timeout 8s и keyword fallback.
Модель по умолчанию: `gpt-4o-mini` (override через env `OPENAI_MODEL`).
Если `OPENAI_API_KEY` не задан — автоматически падает на rules-based keyword matching.

---

## 3. Flow оркестратора (знай наизусть)

```
POST /api/orchestrate
  → lib/orchestrator/router.ts → orchestrate()
    → lib/orchestrator/classify.ts → classifyIntent()
      → lib/orchestrator/classify-llm.ts (LLM, timeout 8s) ─┐ параллельно
      → classifyByRegistry() — keyword matching              ─┘
      → победитель: LLM если confidence >= 0.75, иначе max(llm, keyword)
    → lib/orchestrator/logger.ts → logOrchestratorRun() (async, всегда)
    → проверка confidence vs ORCHESTRATOR_THRESHOLDS (lib/orchestrator/policies.ts)
      → needsClarification=true → вернуть clarificationQuestion
      → confidence < 0.45 → buildFallbackResponse() (lib/orchestrator/fallback.ts)
      → confidence >= 0.45 → lib/orchestrator/executor.ts → executeWorkflow()
        → workflow.run(text, ctx) из registry → lib/services/{workflow}.ts
```

**Ключевые файлы оркестратора:**
- `lib/orchestrator/registry.ts` — ЕДИНСТВЕННОЕ место добавления нового workflow
- `lib/orchestrator/policies.ts` — пороги confidence (execute: 0.75, recommend: 0.45)
- `lib/orchestrator/classify.ts` — точка входа классификации (LLM + keyword)
- `lib/orchestrator/classify-llm.ts` — LLM-классификатор (GPT, json_object)
- `lib/orchestrator/router.ts` — точка входа, собирает всё вместе
- `lib/orchestrator/logger.ts` — логирует каждый запрос в analytics_events

---

## 4. Архитектурные инварианты (нельзя нарушать)

```
1. НОВЫЙ WORKFLOW = одна запись в lib/orchestrator/registry.ts
   Не трогай router.ts, executor.ts или classify.ts при добавлении workflow.

2. БИЗНЕС-ЛОГИКА только в lib/services/*
   Route handlers содержат только: auth check → input validation → вызов сервиса → return JSON.
   Никакой логики OpenAI, никаких запросов к БД напрямую в route handler.

3. СЕКРЕТЫ только на сервере
   SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN — никогда в клиентский код.
   NEXT_PUBLIC_* — единственные переменные, допустимые в клиенте.

4. OpenAI НЕ ВЫЗЫВАЕТСЯ из клиентских компонентов
   Только через /api/* route handlers.

5. LIB/SERVICES/* ВЫЗЫВАЮТСЯ НАПРЯМУЮ (без HTTP)
   Сервисы должны работать как из route handler, так и из n8n-webhook или скрипта.
   Не делай сервисы зависимыми от Request/Response.

6. TELEGRAM WEBHOOK ВСЕГДА ОТВЕЧАЕТ 200 OK
   Даже при ошибке обработки — иначе Telegram ретраит бесконечно.
   Логируй ошибку внутри, но возвращай { ok: true }.

7. UPLOAD НЕ БЛОКИРУЕТ
   /api/upload принимает файл, создаёт documents(status: "pending"), сразу отвечает.
   Чанкинг и embeddings — в background через waitUntil() или очередь.

8. RLS ВКЛЮЧЁН для всех пользовательских таблиц
   Никогда не делай запрос через service_role client там, где достаточно user client.
   Service role обходит RLS — используй только в background jobs.
```

---

## 5. Структура папок (быстрый справочник)

```
lib/orchestrator/
  registry.ts       ← единственное место описания workflow
  classify.ts       ← classifyIntent() — LLM-first + keyword fallback
  classify-llm.ts   ← LLM-классификатор (GPT, json_object, 8s timeout)
  router.ts         ← точка входа: orchestrate(input)
  executor.ts       ← вызов workflow.run()
  fallback.ts       ← buildFallbackResponse()
  policies.ts       ← ORCHESTRATOR_THRESHOLDS
  logger.ts         ← logOrchestratorRun() — каждый запрос в analytics_events

lib/services/
  content/
    rag-qa.ts           ← rag_qa ✅ (expand-query + retrieve + citations + GPT)
    lecture-insight.ts  ← lecture_insight (частично)
    explain.ts          ← explain_this (частично)
    cheatsheet.ts       ← cheat_sheet (частично)
    quiz.ts             ← quiz_generator (частично)
  planning/
    tasks.ts            ← task_extractor ✅
    planner.ts          ← study_plan (частично)
  communication/
    letters.ts          ← letter_generator ✅
  documents/
    ingestion.ts        ← processDocument() — PDF/audio → chunk → embed → pgvector
    transcribe.ts       ← transcribeAudio() — Whisper

lib/rag/
  chunk.ts          ← chunkText() — sentence-based, overlap=2 предложения
  embed.ts          ← embedText/embedBatch/embedBatchSafe — text-embedding-3-small (1536d)
  retrieve.ts       ← retrieveRelevantChunks() — pgvector match_document_chunks RPC
  citations.ts      ← buildCitations() — excerpt 200 chars, sorted by similarity
  expand-query.ts   ← expandQuery() — 2 LLM-перефразировки для повышения recall

lib/ai/
  client.ts         ← getOpenAIClient(), DEFAULT_MODEL (gpt-4o-mini, override OPENAI_MODEL)
  retry.ts          ← withRetry() — exponential backoff для OpenAI calls
  token-guard.ts    ← guardContext() — обрезает chunks под context window модели
  prompts.ts        ← системные промпты
  schemas.ts        ← JSON schema для structured output

lib/integrations/
  youtube.ts        ← getYouTubeTranscript() — timed-text API, приоритет ru > en
  smartlms.ts       ← HSE SmartLMS / Moodle REST API (SMARTLMS_BASE_URL)
  ical.ts           ← parseIcal() — RFC 5545, zero-deps (Google/Outlook/HSE)

lib/repository/
  auth.ts, documents.ts, letters.ts, tasks.ts ← DB access layer

lib/api/
  helpers.ts        ← shared route handler utilities
  rate-limit.ts     ← rate limiting middleware

lib/supabase/
  client.ts         ← браузерный клиент (anon key)
  server.ts         ← серверный клиент (service role)
  middleware.ts     ← auth middleware для Next.js

lib/analytics/
  events.ts         ← trackEvent() ✅ — insert в analytics_events
  funnel.ts         ← funnel tracking — заглушка
  metrics.ts        ← metrics queries — заглушка

lib/telegram/
  bot.ts            ← Telegram API helpers
  handlers.ts       ← handleTelegramUpdate() ✅ (text + voice + caption)

lib/logger.ts       ← createLogger(scope) — structured logging
lib/constants/
  workflows.ts      ← AVAILABLE_WORKFLOWS, WorkflowName type

app/api/
  orchestrate/route.ts              ← POST /api/orchestrate
  upload/route.ts                   ← POST /api/upload
  rag/query/route.ts                ← POST /api/rag/query
  telegram/webhook/route.ts         ← POST /api/telegram/webhook
  transcribe/route.ts               ← POST /api/transcribe
  analytics/event/route.ts          ← POST /api/analytics/event
  documents/[id]/status/route.ts    ← GET  /api/documents/:id/status
  integrations/youtube/route.ts     ← POST /api/integrations/youtube
  integrations/smartlms/sync/route.ts ← POST /api/integrations/smartlms/sync
  integrations/ical/import/route.ts ← POST /api/integrations/ical/import
  (+ letters, tasks, planner, cheatsheet, quiz, chat)
```

---

## 6. Команды для работы

```bash
# Разработка
npm run dev          # next dev --turbopack → http://localhost:3000

# Проверка типов (запускай после изменений в lib/*)
npx tsc --noEmit

# Линтинг
npm run lint

# Сборка (проверка перед деплоем)
npm run build

# Telegram tunnel для локальной разработки
cloudflared tunnel --url http://localhost:3000

# Применить миграцию БД (если есть Supabase CLI)
npx supabase db push

# Seed данных
npx tsx scripts/seed.ts

# Ingest документов (скрипт)
npx tsx scripts/ingest-documents.ts
```

---

## 7. Правила агентного режима (Claude Code)

### Что можно делать автономно:
- Читать любые файлы проекта
- Создавать новые файлы в рамках существующей структуры
- Редактировать заглушки в `lib/services/*` и `lib/rag/*`
- Запускать `npx tsc --noEmit` и `npm run lint` для проверки
- Запускать `npm run build` для проверки сборки

### Что требует явного подтверждения пользователя:
- Изменение схемы БД (создание новых миграций)
- Установка новых npm-пакетов
- Изменение `lib/orchestrator/registry.ts` (добавление/удаление workflow)
- Изменение `lib/orchestrator/policies.ts` (пороги confidence)
- Изменение `supabase/policies.sql` (RLS политики)
- Любые изменения в `app/(auth)/*` (auth flow)
- Редактирование уже применённых миграций (`supabase/migrations/*`)

### Никогда не делать без явного разрешения:
- `npm install` без обоснования и альтернатив
- Хардкод секретов или API-ключей в коде
- Удаление файлов миграций
- Массовый рефакторинг несвязанных файлов
- Изменение `.env.example` с реальными значениями

---

## 8. NFR-правила для генерируемого кода

### Обработка ошибок
```typescript
// ПРАВИЛЬНО — структурированная ошибка
return NextResponse.json(
  { ok: false, error: "classification_failed", message: "..." },
  { status: 500 }
);

// НЕПРАВИЛЬНО — голый throw или неструктурированный ответ
throw new Error("something went wrong");
```

### Timeout для внешних вызовов
```typescript
// Всегда указывай timeout для OpenAI и Supabase запросов
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30_000);
```

### Валидация входных данных в route handlers
```typescript
// Всегда валидируй перед вызовом сервиса
if (!body.text || typeof body.text !== "string") {
  return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
}
```

### Auth check в route handlers
```typescript
// Всегда первым делом в route handler
const supabase = getSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}
```

### Structured output fallback
```typescript
// При парсинге LLM JSON — всегда try/catch с fallback
try {
  const parsed = JSON.parse(llmResponse);
  // использовать parsed
} catch {
  // fallback на route_recommender, не throw
  return buildFallbackResponse();
}
```

---

## 9. Типы данных (ключевые)

```typescript
// Идентификаторы workflow — lib/constants/workflows.ts
type WorkflowName =
  | "lecture_insight" | "rag_qa" | "letter_generator" | "task_extractor"
  | "study_plan" | "explain_this" | "cheat_sheet" | "quiz_generator"
  | "route_recommender";

// Результат классификации — lib/orchestrator/classify.ts
type ClassificationResult = {
  intent: WorkflowName;
  confidence: number;        // 0.0 – 1.0
  reason: string;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

// Входные данные оркестратора — lib/orchestrator/router.ts
type OrchestratorInput = {
  text: string;
  channel: "web" | "telegram";
  attachments?: unknown[];
  userId?: string;  // auth user id, forwarded to workflows (required for rag_qa)
};

// Статусы документа — supabase/migrations/0001_init.sql
type DocumentProcessingStatus = "pending" | "processing" | "ready" | "failed" | "partial";
// "partial" — часть chunks сохранена, произошла ошибка при batch insert
```

---

## 10. Единые источники правды

| Что | Где |
|-----|-----|
| ID всех workflow | `lib/constants/workflows.ts` |
| Описание workflow (keywords, handler) | `lib/orchestrator/registry.ts` |
| Пороги confidence | `lib/orchestrator/policies.ts` |
| Схема БД | `supabase/migrations/0001_init.sql` |
| RLS политики | `supabase/policies.sql` |
| API контракты | `docs/api.md` |
| Env vars с описанием | `product.md` → секция 13 |

---

## 11. Документация

| Файл | Когда читать |
|------|-------------|
| `product.md` | Всегда первым — продукт, NFR, lifecycle |
| `docs/architecture.md` | При изменении слоёв системы |
| `docs/orchestrator.md` | При работе с оркестратором |
| `docs/database.md` | При работе со схемой БД |
| `docs/api.md` | При изменении API контрактов |
| `docs/deployment.md` | При работе с деплоем и Telegram |
| `docs/adr/` | При значимых архитектурных решениях |

---

## 12. MCP-коннекторы и скиллы

### Доступные MCP-коннекторы

| Коннектор | Когда использовать |
|-----------|-------------------|
| **Supabase MCP** (`mcp__338...`) | `execute_sql`, `list_tables`, `apply_migration`, `get_advisors` — работа со схемой БД напрямую |
| **Claude Preview** (`mcp__Claude_Preview__*`) | Превью Next.js приложения, скриншоты, инспект DOM |
| **Claude in Chrome** (`mcp__Claude_in_Chrome__*`) | Браузерное тестирование, навигация, отладка UI |
| **MCP Registry** (`mcp__mcp-registry__*`) | Поиск и подключение новых MCP-серверов |
| **Scheduled Tasks** (`mcp__scheduled-tasks__*`) | Планирование фоновых задач |

### Доступные скиллы

| Скилл | Когда использовать |
|-------|-------------------|
| `/rag-architect` | Проектирование RAG-пайплайна, выбор стратегии retrieval |
| `/senior-backend` | Скаффолдинг API, оптимизация запросов к БД |
| `/senior-fullstack` | Полный стек: Next.js + Supabase + OpenAI |
| `/mcp-builder` | Создание новых MCP-серверов |
| `/claude-md-management:revise-claude-md` | Обновить CLAUDE.md по итогам сессии |
| `/claude-md-improver` | Аудит и улучшение CLAUDE.md |

### Типичные задачи через MCP

```bash
# Проверить схему БД
→ Supabase MCP: list_tables, execute_sql

# Посмотреть приложение
→ Claude Preview: preview_start → preview_screenshot

# Применить миграцию
→ Supabase MCP: apply_migration

# Получить советы по производительности БД
→ Supabase MCP: get_advisors
```
