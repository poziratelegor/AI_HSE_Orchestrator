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

Это **starter-kit**. Структура и архитектура готовы. Реализация — заглушки.

| Слой | Файлы | Статус |
|------|-------|--------|
| Оркестратор (routing, classify, registry) | `lib/orchestrator/*` | ✅ scaffold — работает rules-based |
| Сервисы (бизнес-логика workflow) | `lib/services/*` | ⚙️ заглушки — нужна реализация |
| RAG pipeline | `lib/rag/*` | ⚙️ заглушки — нужна реализация |
| OpenAI интеграция | `lib/openai/*` | ⚙️ промпты и схемы — нужна реализация |
| Supabase клиент | `lib/supabase/*` | ✅ работает |
| Telegram | `lib/telegram/*` | ⚙️ заглушка — нужна реализация |
| Аналитика | `lib/analytics/*` | ⚙️ заглушка — нужна реализация |
| Route handlers | `app/api/*` | ✅ scaffold — нет auth, нет валидации |
| UI | `components/*`, `app/dashboard/*` | ⚙️ структура без реализации |
| БД миграция | `supabase/migrations/0001_init.sql` | ✅ готово |
| RLS политики | `supabase/policies.sql` | ⚙️ нужна проверка и применение |

**Важно:** классификатор в `lib/orchestrator/classify.ts` сейчас **rules-based** (keyword matching), НЕ LLM. Schema и промпты для LLM-классификации готовы в `lib/openai/`, но не подключены.

---

## 3. Flow оркестратора (знай наизусть)

```
POST /api/orchestrate
  → lib/orchestrator/router.ts → orchestrate()
    → lib/orchestrator/classify.ts → classifyIntent()
      → WORKFLOW_REGISTRY в lib/orchestrator/registry.ts
      → keyword matching по полю workflow.keywords
    → проверка confidence vs ORCHESTRATOR_THRESHOLDS (lib/orchestrator/policies.ts)
      → confidence >= 0.75 → lib/orchestrator/executor.ts → executeWorkflow()
        → workflow.run(text) из registry → lib/services/{workflow}.ts
      → 0.45–0.74 → buildFallbackResponse() (lib/orchestrator/fallback.ts)
      → < 0.45 → clarification question
```

**Ключевые файлы оркестратора:**
- `lib/orchestrator/registry.ts` — ЕДИНСТВЕННОЕ место добавления нового workflow
- `lib/orchestrator/policies.ts` — пороги confidence (execute: 0.75, recommend: 0.45)
- `lib/orchestrator/classify.ts` — логика классификации
- `lib/orchestrator/router.ts` — точка входа, собирает всё вместе

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
  registry.ts    ← единственное место описания workflow
  classify.ts    ← логика классификации intent
  router.ts      ← точка входа: orchestrate(input)
  executor.ts    ← вызов workflow.run()
  fallback.ts    ← buildFallbackResponse()
  policies.ts    ← ORCHESTRATOR_THRESHOLDS

lib/services/
  letters.ts          ← letter_generator (заглушка)
  lecture-insight.ts  ← lecture_insight (заглушка)
  rag-qa.ts           ← rag_qa (заглушка)
  tasks.ts            ← task_extractor (заглушка)
  planner.ts          ← study_plan (заглушка)
  explain.ts          ← explain_this (заглушка)
  cheatsheet.ts       ← cheat_sheet (заглушка)
  quiz.ts             ← quiz_generator (заглушка)

lib/rag/
  chunk.ts      ← chunkText() — базовая реализация есть, без overlap
  embed.ts      ← embedText() — ЗАГЛУШКА, нужен OpenAI embeddings
  retrieve.ts   ← retrieveRelevantChunks() — ЗАГЛУШКА, нужен pgvector
  citations.ts  ← buildCitations() — ЗАГЛУШКА

lib/openai/
  client.ts     ← OpenAI client (нужно создать)
  prompts.ts    ← системные промпты
  schemas.ts    ← JSON schema для structured output

lib/supabase/
  client.ts     ← браузерный клиент (anon key)
  server.ts     ← серверный клиент (service role)
  middleware.ts ← auth middleware для Next.js

lib/analytics/
  events.ts     ← trackEvent() — ЗАГЛУШКА
  funnel.ts     ← funnel tracking — ЗАГЛУШКА
  metrics.ts    ← metrics queries — ЗАГЛУШКА

lib/telegram/
  bot.ts        ← Telegram API helpers
  handlers.ts   ← handleTelegramUpdate() — ЗАГЛУШКА

lib/constants/
  workflows.ts  ← AVAILABLE_WORKFLOWS, WorkflowName type

app/api/
  orchestrate/route.ts    ← POST /api/orchestrate
  upload/route.ts         ← POST /api/upload
  rag/query/route.ts      ← POST /api/rag/query
  telegram/webhook/route.ts ← POST /api/telegram/webhook
  transcribe/route.ts     ← POST /api/transcribe
  analytics/event/route.ts ← POST /api/analytics/event
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
};

// Статусы документа — supabase/migrations/0001_init.sql
type DocumentProcessingStatus = "pending" | "processing" | "ready" | "failed";
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
