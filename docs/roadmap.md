# Дорожная карта StudyFlow AI

> Обновлено: 2026-04-19. Состояние: Фазы 0–2 закрыты, Фазы 3–6 — план развития.

## Текущее состояние ✅

**Backend / AI слой — production-ready:**
- ✅ LLM-first классификатор (gpt-4o-mini, 8s timeout, keyword fallback)
- ✅ 9 workflow реализовано через единый registry
- ✅ Централизованная библиотека промптов (`lib/ai/prompts.ts`) с few-shot, anti-hallucination, JSON-discipline
- ✅ Персонализация через `loadStudentContext()` — имя, факультет, курс, группа в каждом промпте
- ✅ RAG-пайплайн: chunk → embed → pgvector → expand-query → citations
- ✅ Все OpenAI вызовы через `withRetry` (exponential backoff)
- ✅ `guardContext` обрезает chunks под model context window
- ✅ Telegram-бот: текст, голос (Whisper), документы
- ✅ Email через Resend (`/api/email/send`)
- ✅ Sentry: client/server/edge configs + global error boundary
- ✅ Rate limiting через Upstash Redis
- ✅ Интеграции: YouTube transcripts, SmartLMS, iCal
- ✅ Тесты: **76 passing** (10 файлов, vitest)
- ✅ Сборка: **33 routes**, TypeCheck без ошибок

**Что ещё НЕ закрыто:**
- ⚙️ UI/UX — структура есть, реализации компонентов нет
- ⚙️ RLS-политики — миграция готова, нужна верификация
- ⚙️ Дашборды funnel/metrics — заглушки в `lib/analytics/`
- ⚙️ E2E-тесты — каркас есть в `tests/e2e/`, сценариев нет

---

## Фаза 3 — UI/UX (1-2 недели)

**Цель:** довести фронтенд до уровня бэкенда.

### Компоненты дашборда (`components/dashboard/`)
- [ ] `AssistantChat` — чат с поддержкой стриминга, attachments, голосового ввода
  - Использовать `react-markdown` для рендера ответов
  - Подсветка цитат [1] [2] с tooltip превью chunk_text
- [ ] `DocumentList` — табличный вид с фильтрацией по статусу + drag-and-drop upload
- [ ] `LetterEditor` — preview + edit before send via Resend
- [ ] `TaskBoard` — kanban (pending / in_progress / done) с drag-and-drop
- [ ] `StudyPlanCalendar` — weekly view с переносом дней

### Auth flow
- [ ] `/login` и `/signup` через Supabase Auth UI
- [ ] OAuth Google + HSE SSO (если есть provider)
- [ ] `/complete-profile` форма для заполнения StudentContext полей

### Дизайн-система
- [ ] Подключить `shadcn/ui` или `radix-ui` + `tailwindcss-animate`
- [ ] Темизация: light/dark через `next-themes`
- [ ] Skeleton loaders на каждый dashboard route
- [ ] Toast-уведомления через `sonner` для async операций

### Оптимизация
- [ ] Server Components везде, где возможно — клиентский bundle <100KB
- [ ] Image optimization для аватарок (next/image)
- [ ] Suspense + streaming для долгих RAG-запросов

---

## Фаза 4 — Качество и наблюдаемость (1 неделя)

**Цель:** prod-grade observability и надёжность.

### Аналитика и метрики
- [ ] Реализовать `lib/analytics/funnel.ts`:
  - Воронка: visit → upload → first_query → rag_answer → letter_sent
  - SQL-запросы к `analytics_events` с агрегацией по дню/недели
- [ ] Реализовать `lib/analytics/metrics.ts`:
  - p50/p95/p99 latency по workflow
  - Confidence distribution (для калибровки thresholds)
  - Token usage / cost per user (через OpenAI usage API)
- [ ] Дашборд `/dashboard/analytics` (admin only) с графиками — Recharts или Tremor

### Sentry улучшения
- [ ] Performance Monitoring: `Sentry.startSpan()` вокруг workflow.run()
- [ ] User context: `Sentry.setUser({ id: userId })` после auth
- [ ] Release tracking: автоматический upload sourcemaps в CI
- [ ] Custom alerts: error rate > 1%, p95 latency > 10s

### E2E тесты
- [ ] Playwright setup для критичных пользовательских путей:
  - Регистрация → upload → query → получение ответа с цитатами
  - Генерация письма → отправка через email
  - Извлечение задач → отображение в TaskBoard
- [ ] Mock OpenAI responses через MSW для детерминированности

### Качество промптов
- [ ] Eval-фреймворк: набор из 50 запросов с эталонными ответами
- [ ] A/B тестирование: сравнить gpt-4o-mini vs gpt-4o на качестве классификации
- [ ] Логировать `prompt_tokens` / `completion_tokens` в `analytics_events` для оптимизации

---

## Фаза 5 — Расширение функциональности (2-3 недели)

**Цель:** добавить ценные фичи поверх стабильного MVP.

### Новые workflows
- [ ] `flashcards_generator` — Anki-совместимые карточки из материала
- [ ] `essay_reviewer` — критика эссе/курсовых с предложениями улучшений
- [ ] `code_explainer` — для CS-студентов: построчный разбор кода
- [ ] `formula_solver` — пошаговое решение математических задач (с LaTeX)
- [ ] `summarize_video` — суммаризация YouTube-лекций (уже есть transcript)

### RAG улучшения
- [ ] Hybrid search: BM25 + dense (pgvector) с reranking
- [ ] Cross-encoder reranking через `cohere-rerank` или локальный bge-reranker
- [ ] Multi-query retrieval (уже есть expand-query, но довести до 5 вариантов)
- [ ] Document hierarchy: главы → разделы → параграфы для контекстного retrieval
- [ ] Hyde (Hypothetical Document Embeddings) для сложных вопросов

### Интеграции
- [ ] Notion API — экспорт конспектов лекций
- [ ] Google Calendar — двусторонняя синхронизация tasks
- [ ] Anki Connect — экспорт flashcards напрямую в десктоп Anki
- [ ] HSE LMS — глубокая интеграция с расписанием и оценками
- [ ] Whisper API streaming — realtime транскрипция голоса

### Telegram бот
- [ ] Inline-кнопки для подтверждения intent (когда confidence < 0.75)
- [ ] Команды: `/tasks`, `/upload`, `/letter`, `/quiz`
- [ ] Push-нотификации о приближающихся дедлайнах (cron job)

---

## Фаза 6 — Производительность и масштабирование (1-2 недели)

**Цель:** держать sub-second latency на 1000+ MAU.

### Кеширование
- [ ] Upstash Redis для embedding cache: hash(text) → vector (TTL 7 дней)
- [ ] Кеш классификации: hash(query) → ClassificationResult (TTL 1 час)
- [ ] CDN для статических ответов / шаблонов писем

### База данных
- [ ] Индексы: `documents.user_id`, `tasks.user_id + due_date`, `letters.user_id + created_at`
- [ ] Партиционирование `analytics_events` по месяцам
- [ ] HNSW индекс для pgvector с настройкой `m=16, ef_construction=64`
- [ ] Materialized views для дашбордов (рефреш каждые 5 мин)

### Background jobs
- [ ] Перевести document ingestion на очередь (Inngest / Trigger.dev)
- [ ] Webhook retry с DLQ для Telegram
- [ ] Scheduled tasks: дайджест дедлайнов утром в 9:00, повтор слабых тем за 3 дня до экзамена

### Cost optimization
- [ ] Прокси через Helicone для cost tracking + caching
- [ ] Routing: простые запросы → gpt-4o-mini, сложные → gpt-4o
- [ ] Batched embeddings через OpenAI Batch API (-50% стоимости)
- [ ] Локальные эмбеддинги для дешёвых задач (bge-small-en через Ollama)

---

## Технический долг

### Высокий приоритет
- [ ] Применить и проверить RLS-политики (`supabase/policies.sql`)
- [ ] Завершить реализацию `complete-profile` — пользователь без полного профиля не должен попадать в dashboard
- [ ] Добавить rate-limiting на все expensive routes (`/api/orchestrate`, `/api/upload`, `/api/transcribe`)

### Средний приоритет
- [ ] Унифицировать error response shape — всегда `{ ok: false, error: code, message: string }`
- [ ] Извлечь magic numbers (timeouts, thresholds) в `lib/constants/`
- [ ] Заменить `console.error` на `logger` во всех сервисах
- [ ] JSDoc для всех публичных функций в `lib/services/`

### Низкий приоритет
- [ ] Storybook для компонентов
- [ ] Husky + lint-staged для pre-commit
- [ ] Conventional commits + автогенерация CHANGELOG

---

## Возможные пакеты для добавления

| Пакет | Зачем | Приоритет |
|-------|-------|-----------|
| `zod` | Runtime валидация input в route handlers | **Высокий** |
| `react-hook-form` + `@hookform/resolvers` | Формы с валидацией | **Высокий** |
| `shadcn/ui` (через CLI) | Дизайн-система | **Высокий** |
| `sonner` | Toast-уведомления | Средний |
| `react-markdown` + `remark-gfm` | Рендер ответов RAG | Средний |
| `tremor` или `recharts` | Графики для дашбордов | Средний |
| `playwright` | E2E тесты | Средний |
| `msw` | Mock OpenAI в тестах | Средний |
| `@inngest/sdk` | Очереди для background jobs | Низкий |
| `sharp` | Optimization превью документов | Низкий |
| `katex` | Рендер математических формул | Низкий (для formula_solver) |

---

## Метрики успеха

| Метрика | Цель Q2 2026 | Текущий статус |
|---------|--------------|----------------|
| MAU | 500 | — (не запущено) |
| Avg session duration | > 8 мин | — |
| Workflow success rate | > 92% | — (нет метрик) |
| Classify confidence p50 | > 0.85 | — |
| RAG citation precision | > 80% | — |
| p95 orchestrate latency | < 4s | — |
| Cost per active user / мес | < $0.50 | — |
| NPS студентов ВШЭ | > 50 | — |

---

## Связанные документы

- `docs/product.md` — продуктовая стратегия и NFR
- `docs/architecture.md` — слои системы
- `docs/orchestrator.md` — как работает routing и classification
- `docs/rag.md` — RAG-пайплайн
- `docs/api.md` — API контракты
- `docs/deployment.md` — деплой и Telegram setup
- `docs/database.md` — схема БД
- `docs/adr/` — архитектурные решения
