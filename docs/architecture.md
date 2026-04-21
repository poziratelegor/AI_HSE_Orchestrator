# Архитектура системы

## Обзор

StudyFlow AI построен в виде шести горизонтальных слоёв. Каждый слой зависит только от слоёв ниже — импорты вверх по стеку запрещены.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Каналы ввода                            │
│         Веб-приложение (Next.js 15)  │  Telegram-бот            │
├─────────────────────────────────────────────────────────────────┤
│                           API-слой                              │
│   Route Handlers · Проверка auth · Валидация · JSON-ответ      │
├─────────────────────────────────────────────────────────────────┤
│                       Движок оркестратора                       │
│        Классификация намерения → Оценка confidence → Роутинг   │
├─────────────────────────────────────────────────────────────────┤
│                        Сервисы воркфлоу                         │
│   rag_qa · letter · tasks · lecture · plan · quiz · explain    │
├─────────────────────────────────────────────────────────────────┤
│                         Знания / RAG                            │
│         Chunk  ·  Embed  ·  Retrieve  ·  Expand  ·  Cite       │
├─────────────────────────────────────────────────────────────────┤
│                      Данные и интеграции                        │
│     Supabase · pgvector · OpenAI · Telegram · Redis · Sentry   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Компонентная диаграмма

```mermaid
graph TB
    subgraph Client["Каналы ввода"]
        WEB["🌐 Веб-приложение\n/dashboard"]
        TG["✈️ Telegram-бот"]
    end

    subgraph APILayer["API-слой — app/api/"]
        ORCH_API["orchestrate/route.ts"]
        UPLOAD_API["upload/route.ts\nМИМЕ + проверка magic-bytes"]
        RAG_API["rag/query/route.ts\nСначала Redis-кэш"]
        TG_API["telegram/webhook/route.ts\nПроверка secret-заголовка"]
        MISC_API["letters · tasks · quiz\nplanner · transcribe · chat"]
    end

    subgraph OrchestratorLayer["Оркестратор — lib/orchestrator/"]
        ROUTER["router.ts\norchestrate()"]
        CLASSIFY["classify.ts\nclassifyIntent()"]
        LLM_C["classify-llm.ts\nGPT-4o · json_object\nтаймаут 8 с"]
        KW_C["Сканирование ключевых слов реестра"]
        POLICIES["policies.ts\nвыполнить ≥ 0.75\nрекомендовать ≥ 0.45"]
        EXECUTOR["executor.ts\nexecuteWorkflow()"]
        REGISTRY["registry.ts\n9 определений воркфлоу"]
        LOGGER["logger.ts\nlogOrchestratorRun()"]
        FALLBACK["fallback.ts"]
    end

    subgraph ServicesLayer["Сервисы — lib/services/"]
        RAG_SVC["content/rag-qa.ts"]
        LETTER_SVC["communication/letters.ts"]
        TASKS_SVC["planning/tasks.ts"]
        LECTURE_SVC["content/lecture-insight.ts"]
        OTHER_SVC["quiz · cheatsheet · explain · planner"]
        INGEST["documents/ingestion.ts\nPDF/аудио → chunk → embed"]
        TRANSCRIBE["documents/transcribe.ts\nWhisper STT"]
    end

    subgraph RAGLayer["RAG-пайплайн — lib/rag/"]
        CHUNK["chunk.ts\nпо предложениям, 800 токенов"]
        EMBED["embed.ts\ntext-embedding-3-small\nбатч + retry"]
        RETRIEVE["retrieve.ts\nRPC match_document_chunks"]
        EXPAND["expand-query.ts\n3 перефразировки от LLM"]
        CITE["citations.ts\nвыдержка 200 символов"]
    end

    subgraph AILayer["AI — lib/ai/"]
        AI_CLIENT["client.ts\nмульти-провайдерная фабрика"]
        RETRY["retry.ts\nэкспоненциальный backoff"]
        TOKEN_GUARD["token-guard.ts\nguardContext()"]
    end

    subgraph Infra["Инфраструктура"]
        SUPABASE[("Supabase\nPostgreSQL + pgvector")]
        OPENAI["OpenAI\nGPT-4o-mini · Whisper"]
        REDIS[("Upstash Redis\nREST, без SDK")]
        SENTRY["Sentry"]
    end

    WEB --> ORCH_API & UPLOAD_API & RAG_API
    TG --> TG_API

    ORCH_API --> ROUTER
    ROUTER --> CLASSIFY
    CLASSIFY --> LLM_C & KW_C
    CLASSIFY --> POLICIES
    POLICIES --> EXECUTOR & FALLBACK
    EXECUTOR --> REGISTRY
    REGISTRY --> RAG_SVC & LETTER_SVC & TASKS_SVC & LECTURE_SVC & OTHER_SVC
    ROUTER --> LOGGER

    RAG_SVC --> EXPAND --> EMBED --> RETRIEVE
    RETRIEVE --> CITE
    INGEST --> CHUNK --> EMBED
    TRANSCRIBE --> OPENAI
    UPLOAD_API --> INGEST

    RAG_API --> REDIS
    RAG_API --> RAG_SVC

    ServicesLayer --> AI_CLIENT
    AI_CLIENT --> RETRY
    RAG_SVC --> TOKEN_GUARD

    AI_CLIENT --> OPENAI
    RETRIEVE --> SUPABASE
    EMBED --> OPENAI
    LOGGER --> SUPABASE
    MISC_API --> SUPABASE
    APILayer --> REDIS
    APILayer --> SENTRY
```

---

## Диаграмма потоков (из README)

```mermaid
graph TB
    subgraph Channels["Каналы ввода"]
        WEB["🌐 Веб-приложение\nNext.js 15"]
        TG["✈️ Telegram-бот"]
    end

    subgraph API["API-слой (Route Handlers)"]
        ORCH["POST /api/orchestrate"]
        UPLOAD["POST /api/upload"]
        RAG_API["POST /api/rag/query"]
        TG_WH["POST /api/telegram/webhook"]
    end

    subgraph Orchestrator["Движок оркестратора"]
        ROUTER["Router"]
        CLASSIFY["Классификатор намерений\n━━━━━━━━━━━━\nLLM (GPT-4o) ‖ Ключевые слова\nпараллельно, таймаут 8 с"]
        EXECUTOR["Исполнитель воркфлоу"]
        REGISTRY["Реестр · 9 воркфлоу"]
    end

    subgraph Services["Сервисы воркфлоу"]
        S1["rag_qa"]
        S2["letter_generator"]
        S3["task_extractor"]
        S4["lecture_insight"]
        S5["study_plan · quiz\ncheatsheet · explain"]
    end

    subgraph RAG["RAG-пайплайн"]
        CHUNK["Чанкер\n800 токенов, overlap 2 предложения"]
        EMBED["Эмбеддер\ntext-embedding-3-small\n1536 измерений"]
        RETRIEVE["pgvector поиск\ncosine similarity ≥ 0.5"]
        EXPAND["Расширение запроса\n3 варианта от LLM"]
    end

    subgraph Infra["Инфраструктура"]
        DB[("Supabase\nPostgreSQL + pgvector")]
        AI["OpenAI\nGPT-4o-mini · Whisper"]
        CACHE[("Upstash Redis\nКэш RAG 1 ч · rate limit")]
    end

    WEB --> ORCH & UPLOAD & RAG_API
    TG --> TG_WH
    ORCH --> ROUTER
    ROUTER --> CLASSIFY --> EXECUTOR --> REGISTRY
    REGISTRY --> S1 & S2 & S3 & S4 & S5
    S1 --> RAG
    UPLOAD --> RAG
    RAG --> DB & AI
    Services --> AI
    API --> CACHE & DB
```

**Политика confidence** — классификатор возвращает оценку уверенности от 0.0 до 1.0:

| Оценка | Действие |
|---|---|
| ≥ 0.75 | Выполнить воркфлоу напрямую |
| 0.45 – 0.74 | Показать WorkflowPicker, уточнить намерение |
| < 0.45 | Общий fallback со списком всех воркфлоу |

---

## Жизненный цикл запроса

```
1. Пользователь отправляет текст через веб или Telegram
2. Route handler проверяет auth (Bearer JWT) и форму входных данных
3. Вызывается orchestrate(input) в router.ts
4. LLM-классификатор и сканер ключевых слов запускаются параллельно (таймаут 8 с)
5. Победитель выбирается по confidence — LLM побеждает при ≥ 0.75
6. Confidence проверяется по порогам (policies.ts):
   ≥ 0.75    → executeWorkflow()
   0.45–0.74 → вернуть needsClarification = true
   < 0.45    → buildFallbackResponse()
7. logOrchestratorRun() пишется в analytics_events (async, не блокирует)
8. Возвращается JSON: { ok, workflow, intent, confidence, result }
```

---

## Карта файлов оркестратора

| Файл | Ответственность | Ключевой экспорт |
|---|---|---|
| `registry.ts` | Единственный источник истины для всех воркфлоу | `WORKFLOW_REGISTRY` |
| `classify.ts` | Запускает LLM + ключевые слова параллельно, выбирает победителя | `classifyIntent()` |
| `classify-llm.ts` | Классификация через GPT-4o, json_object, таймаут 8 с | `classifyLLM()` |
| `router.ts` | Собирает полный пайплайн | `orchestrate()` |
| `executor.ts` | Вызывает `workflow.run(text, ctx)` | `executeWorkflow()` |
| `policies.ts` | Пороги confidence | `ORCHESTRATOR_THRESHOLDS` |
| `fallback.ts` | Ответ при слишком низком confidence | `buildFallbackResponse()` |
| `logger.ts` | Асинхронная запись в analytics_events | `logOrchestratorRun()` |

**Правило:** добавление нового воркфлоу = правки только в `registry.ts`.

---

## Архитектурные инварианты

| № | Правило |
|---|---|
| 1 | Новый воркфлоу → одна запись в `registry.ts`, больше ничего |
| 2 | Бизнес-логика только в `lib/services/*` — route handlers — тонкие обёртки |
| 3 | Серверные секреты никогда не попадают в клиентский бандл |
| 4 | Сервисы без HTTP-зависимости — работают из route, вебхука и CLI одинаково |
| 5 | Telegram-вебхук всегда возвращает 200 OK, даже при ошибке |
| 6 | `/api/upload` отвечает за <500 мс; обработка запускается в фоне |
| 7 | `service_role` клиент — только в фоновых задачах, не в пути пользовательского запроса |

---

## Заголовки безопасности

Применяются ко всем маршрутам через `next.config.ts`:

| Заголовок | Значение |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=()` |
| `Content-Security-Policy` | Строгий allowlist — см. `next.config.ts` |

---

## Нефункциональные требования

| Метрика | Цель |
|---|---|
| P95 латентность оркестратора | ≤ 5 с |
| Время ответа на загрузку | ≤ 2 с |
| P95 RAG-запрос | ≤ 6 с |
| ACK Telegram-вебхука | ≤ 200 мс |
| Обработка документа | ≤ 60 с |
| Максимальный размер файла | 20 МБ |
| Uptime | 99.5% |
