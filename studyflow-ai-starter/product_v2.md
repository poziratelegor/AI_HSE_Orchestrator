# product.md — StudyFlow AI

> Это главный компас проекта.
> AI-ассистенты, разработчики и ревьюеры читают его первым — до любого кода.
> Документ описывает продукт, архитектуру, текущий статус реализации, NFR, automation-стратегию и ограничения.

---

## 1. Суть продукта

**StudyFlow AI** — AI-оркестратор для студентов.

Пользователь описывает задачу на естественном языке — через веб-интерфейс или Telegram. Система распознаёт намерение (intent), выбирает подходящий сценарий (workflow) и возвращает результат.

**Ценностное предложение:** вместо переключения между десятками инструментов — одна точка входа с естественным языком.

---

## 2. Целевая аудитория

- Студенты бакалавриата и магистратуры
- Активные пользователи Telegram
- Люди, работающие с лекциями, учебными материалами, дедлайнами и официальной перепиской

**Контекст использования:**
- мобильный Telegram в перерывах
- веб-интерфейс за компьютером для длинных задач
- голосовой ввод для записи лекций

---

## 3. Anti-goals (что система НЕ делает)

- Система не является LMS (learning management system)
- Система не хранит видеофайлы и не стримит медиа
- Система не выполняет действия от имени пользователя (не отправляет письма сама)
- Система не предоставляет ответы на экзаменационные вопросы в обход академической честности
- Система не является публичным чат-ботом — это персональный ассистент конкретного студента
- MVP не поддерживает совместную работу нескольких студентов над одним документом

---

## 4. Ключевые сценарии (Workflows)

Каждый workflow описан в `lib/orchestrator/registry.ts` — единственное место добавления нового workflow.
Идентификаторы workflow определены в `lib/constants/workflows.ts` — единственный источник правды.

**Важно:** все 9 workflow зарегистрированы в `registry.ts` единым списком. Деление ниже на MVP и Phase 2 отражает продуктовый приоритет реализации, а не наличие в реестре.

### MVP (реализовать первыми)

| ID | Название | Описание | Статус |
|----|----------|----------|--------|
| `lecture_insight` | Lecture Insight | Конспект, темы, термины, ключевые идеи из лекции или аудио | ⚙️ stub |
| `rag_qa` | Q&A RAG | Ответы по загруженным учебным материалам с источниками | ⚙️ stub |
| `letter_generator` | Official Letter Generator | Официальные письма преподавателям и администрации | ⚙️ stub |
| `task_extractor` | Task Extractor & Deadline Tracker | Выделение задач и дедлайнов из текста | ⚙️ stub |
| `route_recommender` | Route Recommender | Fallback: помогает пользователю выбрать сценарий | ✅ работает |

### Phase 2 (зарегистрированы, сервисы — stub)

| ID | Название | Описание | Статус |
|----|----------|----------|--------|
| `study_plan` | Study Plan Builder | План подготовки к экзамену | ⚙️ stub |
| `explain_this` | Explain This | Объяснение сложного текста простыми словами | ⚙️ stub |
| `cheat_sheet` | Cheat Sheet Generator | Краткая шпаргалка по теме | ⚙️ stub |
| `quiz_generator` | Quiz Generator | Тесты и карточки для самопроверки | ⚙️ stub |

---

## 5. Текущий статус реализации

| Слой | Файлы | Статус |
|------|-------|--------|
| Оркестратор (routing, classify, registry) | `lib/orchestrator/*` | ✅ scaffold — rules-based, работает |
| Сервисы (бизнес-логика workflow) | `lib/services/*` | ⚙️ все заглушки — нужна реализация |
| RAG — chunk | `lib/rag/chunk.ts` | ⚠️ базовая реализация — overlap не реализован |
| RAG — embed, retrieve, citations | `lib/rag/embed.ts`, `retrieve.ts`, `citations.ts` | ⚙️ заглушки |
| OpenAI client | `lib/openai/client.ts` | ✅ реализован |
| OpenAI prompts + schemas | `lib/openai/prompts.ts`, `schemas.ts` | ✅ определены — не подключены к сервисам |
| LLM-классификация | — | ⚙️ не подключена (schema и промпт готовы) |
| Supabase client (browser + server) | `lib/supabase/client.ts`, `server.ts` | ✅ работает |
| Supabase middleware (auth guard) | `lib/supabase/middleware.ts` | ⚙️ заглушка — withAuthGuard() не работает |
| Route handlers | `app/api/*` | ⚠️ scaffold — нет auth, нет валидации |
| Upload: приём файла | `app/api/upload/route.ts` | ⚙️ заглушка — нет Supabase, нет background processing |
| Telegram webhook | `app/api/telegram/webhook/route.ts` | ⚠️ принимает и верифицирует, handleTelegramUpdate не вызван |
| Telegram bot + handlers | `lib/telegram/*` | ⚙️ заглушки |
| Аналитика | `lib/analytics/*` | ⚙️ заглушки — trackEvent не пишет в БД |
| БД миграция | `supabase/migrations/0001_init.sql` | ✅ готово (все таблицы) |
| RLS политики | `supabase/policies.sql` | ⚙️ только TODO-комментарий — не применено |
| UI компоненты | `components/*` | ⚙️ пустые директории |
| Dashboard pages | `app/dashboard/*` | ⚙️ структура без реализации |

---

## 6. Жизненный цикл запроса

```
User input (text / voice)
        |
        v
  [Transcription?]  <- если голосовой ввод через /api/transcribe (stub)
        |
        v
  POST /api/orchestrate
        |
        v
  normalize input
        |
        v
  classifyIntent() -> { intent, confidence, reason }
  (rules-based: keyword matching по workflow.keywords в registry)
        |
        +-- needsClarification = true -> вернуть clarification question
        +-- confidence < 0.45         -> buildFallbackResponse() (route_recommender)
        +-- confidence >= 0.45        -> executeWorkflow() -> lib/services/{workflow}.ts
                |
                v
        return result to user (web UI или Telegram)
```

**Текущее поведение router.ts vs документированное намерение:**

Код (`router.ts`) не проверяет порог `execute` (0.75) — при `confidence >= 0.45` вызывается `executeWorkflow()` напрямую. Документированное намерение — три полосы (execute / recommend / clarify) — не реализовано в `router.ts`.

На практике это не критично: keyword classifier возвращает либо `0.4` (нет совпадения → fallback), либо `workflow.minConfidence >= 0.75` (совпадение → execute). Средний диапазон 0.45–0.74 будет задействован при подключении LLM-классификатора — тогда же нужно доработать `router.ts`.

Пороги хранятся в `lib/orchestrator/policies.ts`: `execute: 0.75`, `recommend: 0.45`.

Детальная логика — в `docs/orchestrator.md`.

---

## 7. Каналы (Channels)

Система поддерживает два канала. Логика оркестратора одинакова, I/O и форматирование различаются:

| Аспект | `web` | `telegram` |
|--------|-------|------------|
| Вход | assistant page, text area | Telegram message / voice |
| Голосовой ввод | через /api/transcribe | Telegram voice -> /api/transcribe |
| Файлы | upload через /api/upload | file / document из Telegram |
| Формат ответа | rich JSON -> React UI | plain text / Markdown |
| Аутентификация | Supabase session cookie | telegram_user_id -> profiles |
| Канал в логах | "web" | "telegram" |

Поле `channel` обязательно пробрасывается в `orchestrator_runs` и `analytics_events`.

---

## 8. Жизненный цикл документов

Документы обрабатываются **асинхронно**. Блокирующий upload недопустим.

```
POST /api/upload
  -> создать запись documents (status: "pending")
  -> вернуть { ok: true, documentId }   <- fast response
  -> background: chunk -> embed -> index
    -> status: "processing"
    -> success: status = "ready"
    -> failure: status = "failed" + error logged
```

**Текущая реализация:** `app/api/upload/route.ts` — полная заглушка. Принимает JSON тело (не multipart/form-data), не создаёт запись в `documents`, не запускает processing. Нужна реализация с нуля по описанному паттерну.

Пока статус документа не `"ready"`, RAG-запросы по нему недоступны.
Детали схемы — в `docs/database.md`.

---

## 9. Политика оркестратора (Confidence Policy)

Пороги: `ORCHESTRATOR_THRESHOLDS` в `lib/orchestrator/policies.ts`.

| Confidence | Документированное намерение | Текущий код |
|------------|----------------------------|-------------|
| >= 0.75 | Запустить workflow напрямую | Исполняется (т.к. >= 0.45) |
| 0.45 – 0.74 | Вернуть route_recommender | Не реализовано — тоже исполняется |
| < 0.45 | buildFallbackResponse() | Реализовано |

- При любом сбое классификатора → fallback на `route_recommender`, никогда не crash
- Structured output с невалидным JSON → fallback, не выброс исключения

---

## 10. NFR — Нефункциональные требования

### 10.1 Производительность

| Метрика | Цель |
|---------|------|
| Latency /api/orchestrate (P95) | <= 5 секунд |
| Latency /api/upload (принятие файла) | <= 2 секунды |
| Latency /api/rag/query (P95) | <= 6 секунд |
| Telegram webhook response (ack) | <= 200 мс |
| Обработка документа (background) | <= 60 секунд для типичного PDF |

Длинные операции (embeddings, lecture insight) выполняются вне request-response цикла через `waitUntil()` или внешнюю очередь.

### 10.2 Отказоустойчивость

- Если OpenAI API недоступен — вернуть понятную ошибку, сохранить `status: "failed"` в `orchestrator_runs`
- Если классификатор возвращает невалидный JSON — fallback на `route_recommender`
- Если embeddings pipeline падает — документ остаётся в `status: "failed"`, RAG не блокируется
- Telegram webhook всегда отвечает `200 OK` (иначе Telegram ретраит бесконечно)
- Все внешние вызовы имеют явный timeout (OpenAI: 30s, Supabase: 10s)

### 10.3 Безопасность

- Секретные ключи только на сервере: `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`
- Telegram webhook верифицируется через `x-telegram-bot-api-secret-token` (реализовано в `webhook/route.ts`)
- RLS через Supabase: каждый студент видит только своё (RLS политики пока не применены — только TODO в `supabase/policies.sql`)
- Прямые вызовы OpenAI из клиентских компонентов запрещены
- Prompt injection в RAG: пользовательский контент передаётся как `data`, не как `system` instruction
- Все API-роуты проверяют аутентификацию первыми (цель — пока не реализовано ни в одном route handler)
- Загружаемые файлы валидируются по mime-type и размеру (цель — пока не реализовано)

### 10.4 Приватность

- Транскрипции лекций хранятся только если пользователь явно загрузил файл
- `orchestrator_runs.input_text` хранится не дольше 90 дней (через `INPUT_TEXT_RETENTION_DAYS`)
- Персональные данные профиля (ФИО, группа, студенческий ID) используются только для генерации писем
- В `analytics_events` — только агрегированные метрики, без полных текстов запросов
- Документы пользователя не используются для обучения моделей (OpenAI API default)

### 10.5 Наблюдаемость

- Каждый запуск оркестратора логируется в `orchestrator_runs` с latency и статусом (цель — пока не реализовано)
- Каждое значимое событие логируется в `analytics_events` (цель — `trackEvent()` пока заглушка)
- Ошибки имеют структурированный `error_code` (не просто message)
- Dashboard показывает: workflow distribution, success rate, latency trends, funnel (цель — UI пока пустой)

---

## 11. Automation & n8n интеграция

Система спроектирована так, чтобы бизнес-логика была вызываема не только из UI, но и из внешних систем (n8n, cron jobs, webhooks).

### Требования к automation-совместимости

- Все сервисы в `lib/services/*` вызываемы напрямую (без HTTP-вызова)
- Route handlers содержат только I/O и вызов сервиса — бизнес-логика в `lib/services`
- Каждый workflow имеет явный input/output — не зависит от Request/Response
- Операции идемпотентны там, где это возможно

### Кандидаты для n8n automation (Phase 2)

| Workflow | Триггер | Действие |
|----------|---------|----------|
| Task reminders | Cron: ежедневно | Найти задачи с дедлайном через 24ч -> Telegram |
| Document digest | Cron: еженедельно | Summary по новым документам пользователя |
| Document ingestion | Webhook: внешний storage | Принять файл -> запустить chunk + embed |
| Study plan refresh | Webhook | Пересчитать план при новом дедлайне |
| Letter drafts | Webhook | Сгенерировать письмо по шаблону извне |

---

## 12. Стек технологий

| Компонент | Технология | Версия |
|-----------|-----------|--------|
| Frontend / API | Next.js (App Router, Turbopack) | 16.x |
| Язык | TypeScript | 5.x |
| Стили | Tailwind CSS | 3.x |
| База данных / Auth | Supabase (Postgres + RLS) | latest |
| Vector search | pgvector (через Supabase) | — |
| AI inference | OpenAI API | gpt-4o |
| Embeddings | OpenAI API | text-embedding-3-small |
| OpenAI SDK | openai npm | ^5.20.0 |
| Supabase SDK | @supabase/supabase-js | ^2.56.0 |
| Bot | Telegram Bot API (без отдельного SDK) | — |
| Деплой | Vercel | — |

---

## 13. Архитектура папок

```
/app                        -> страницы (App Router), route handlers
  /api                      -> серверные API-роуты (только I/O + вызов сервиса)
  /dashboard                -> dashboard UI
  /(auth)                   -> auth pages
  /(marketing)              -> лендинг
/components                 -> UI-компоненты (без бизнес-логики)
/lib
  /orchestrator             -> classify, registry, router, executor, fallback, policies
  /services                 -> feature-сервисы (один файл = один workflow)
  /rag                      -> chunk, embed, retrieve, citations
  /openai                   -> client, prompts, schemas
  /supabase                 -> client, server, middleware
  /telegram                 -> bot, handlers
  /analytics                -> events, funnel, metrics
  /constants                -> workflows.ts (единый источник ID)
/docs                       -> архитектура, API, БД, деплой, roadmap, ADR
/supabase                   -> миграции, политики RLS, seed
/scripts                    -> ingest-documents, seed, backfill-analytics
/tests                      -> api, orchestrator, e2e (директории пустые)
```

---

## 14. Переменные окружения

### Обязательные (production)

```env
NEXT_PUBLIC_APP_URL=              # Публичный URL приложения
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Supabase anon key (публичный — клиент может читать)
SUPABASE_SERVICE_ROLE_KEY=        # Supabase service role (только сервер — никогда в клиент!)
OPENAI_API_KEY=                   # OpenAI API key (только сервер!)
TELEGRAM_BOT_TOKEN=               # Telegram Bot Token (только сервер!)
TELEGRAM_WEBHOOK_SECRET=          # Secret для верификации Telegram webhook
```

Примечание: `.env.example` содержит только эти 7 переменных. Операционные переменные ниже нужно добавить в `.env.local` вручную.

### Операционные (с дефолтами)

```env
OPENAI_MODEL=gpt-4o                          # Модель для inference
OPENAI_EMBEDDING_MODEL=text-embedding-3-small # Модель для embeddings
ORCHESTRATOR_CONFIDENCE_THRESHOLD=0.45        # Нижняя граница перед fallback
RAG_CHUNK_SIZE=512                            # Размер чанка (токены)
RAG_CHUNK_OVERLAP=64                          # Перекрытие чанков (не реализовано в chunk.ts)
RAG_TOP_K=5                                   # Число чанков для retrieval
MAX_UPLOAD_SIZE_MB=20                         # Лимит загружаемого файла
INPUT_TEXT_RETENTION_DAYS=90                  # Retention для orchestrator_runs.input_text
```

---

## 15. Известные ограничения и риски

| # | Ограничение | Риск | Митигация |
|---|------------|------|-----------|
| 1 | Длинные лекции (>10 мин аудио) | Serverless timeout | waitUntil() + status polling |
| 2 | Качество RAG зависит от чанкинга | Неверные ответы | Тюнинг RAG_CHUNK_SIZE, реализовать overlap |
| 3 | Оркестратор ошибается на ambiguous запросах | Неверный workflow | LLM-классификация + clarification loop |
| 4 | Vercel Serverless timeout 10–60s | Длинные задачи падают | Async processing + status polling |
| 5 | Telegram webhook требует публичный URL | Сложная локальная разработка | cloudflared tunnel |
| 6 | OpenAI API latency непредсказуема | P95 latency страдает | Timeout + fallback message |
| 7 | RLS политики не применены | Утечка данных студентов — критично | Применить supabase/policies.sql первым делом |
| 8 | router.ts не проверяет execute threshold (0.75) | Workflow запускается при confidence 0.45–0.74 | Доработать router.ts при подключении LLM-классификатора |
| 9 | chunk.ts не реализует overlap | Потеря контекста на границах чанков | Реализовать overlap при работе над RAG pipeline |

---

## 16. Архитектурные инварианты (нельзя нарушать)

```
1. НОВЫЙ WORKFLOW = одна запись в lib/orchestrator/registry.ts
   Не трогай router.ts, executor.ts или classify.ts при добавлении workflow.

2. БИЗНЕС-ЛОГИКА только в lib/services/*
   Route handlers: auth check -> input validation -> вызов сервиса -> return JSON.
   Никакой логики OpenAI и никаких запросов к БД в route handler напрямую.

3. СЕКРЕТЫ только на сервере
   SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY, TELEGRAM_BOT_TOKEN — никогда в клиент.
   NEXT_PUBLIC_* — единственные переменные, допустимые в клиенте.

4. OpenAI НЕ ВЫЗЫВАЕТСЯ из клиентских компонентов
   Только через /api/* route handlers.

5. LIB/SERVICES/* ВЫЗЫВАЮТСЯ НАПРЯМУЮ (без HTTP)
   Не делай сервисы зависимыми от Request/Response.
   Они должны работать из route handler, n8n и скрипта одинаково.

6. TELEGRAM WEBHOOK ВСЕГДА ОТВЕЧАЕТ 200 OK
   Даже при ошибке обработки — иначе Telegram ретраит бесконечно.
   Логируй ошибку внутри, но возвращай { ok: true }.

7. UPLOAD НЕ БЛОКИРУЕТ
   /api/upload создаёт documents(status: "pending"), сразу отвечает.
   Чанкинг и embeddings — в background через waitUntil() или очередь.

8. RLS ВКЛЮЧЁН для всех пользовательских таблиц
   Service role обходит RLS — используй только в background jobs.
   Для пользовательских запросов — только user client.
```

---

## 17. Онбординг для AI-ассистента

Читай файлы в этом порядке перед любой задачей:

1. `product.md` <- ты здесь
2. `CLAUDE.md` — правила агентного режима и guardrails
3. `README.md` — быстрый старт и структура проекта
4. `docs/architecture.md` — слои системы
5. `docs/orchestrator.md` — логика маршрутизации
6. `docs/database.md` — схема данных
7. `lib/constants/workflows.ts` — идентификаторы workflow
8. `lib/orchestrator/registry.ts` — реестр workflow

После прочтения этих файлов ты готов работать с любым файлом в проекте без риска нарушить архитектурные инварианты.

**Единые источники правды:**

| Домен | Источник |
|-------|---------|
| ID всех workflow | `lib/constants/workflows.ts` |
| Описание workflow (keywords, handler) | `lib/orchestrator/registry.ts` |
| Пороги confidence | `lib/orchestrator/policies.ts` |
| Схема БД | `supabase/migrations/0001_init.sql` |
| RLS политики | `supabase/policies.sql` |
| API контракты | `docs/api.md` |
| Env vars | секция 14 этого файла |
