<div align="center">

# StudyFlow AI

**AI-оркестратор, который маршрутизирует запросы студентов на естественном языке в нужный рабочий процесс**

<img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js"/>
<img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript"/>
<img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white" alt="Supabase"/>
<img src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white" alt="OpenAI"/>
<img src="https://img.shields.io/badge/pgvector-RAG-blueviolet" alt="pgvector"/>
<img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker"/>

*Опиши задачу своими словами. StudyFlow выберет нужный инструмент и выполнит работу.*

</div>

---

## Как это работает

Студент пишет запрос в **веб-приложении** или **Telegram-боте** на естественном языке. Система классифицирует намерение с помощью LLM, маршрутизирует запрос в один из девяти AI-воркфлоу и возвращает структурированный результат.

```
"Найди что Кейнс говорил про спрос в моих конспектах"
           ↓  классификация  (GPT-4o + keyword fallback)
           ↓  intent = rag_qa  |  confidence = 0.91
           ↓  выполнение  → pgvector поиск → синтез GPT-4o-mini
           ↓
     { answer, citations: [{ title, excerpt, similarity }] }
```

---

## Воркфлоу

| Воркфлоу | Пример запроса | Результат |
|---|---|---|
| `rag_qa` | «Что написано в главе 3 про монополии?» | Ответ с цитатами из документов |
| `letter_generator` | «Напиши заявление на академотпуск декану» | Текст официального письма |
| `task_extractor` | «Выдели все дедлайны из этой программы курса» | Структурированный список задач с датами |
| `lecture_insight` | «Сделай конспект этой 2-часовой записи» | Заголовок, резюме, ключевые тезисы, определения |
| `study_plan` | «Составь план подготовки к экзамену на 2 недели» | Расписание по дням |
| `quiz_generator` | «Сделай тест по главе 3» | MCQ + открытые вопросы |
| `cheat_sheet` | «Сожми это в шпаргалку» | Плотное резюме с терминологией |
| `explain_this` | «Объясни предельную полезность простыми словами» | Объяснение с примерами |
| `route_recommender` | *(неоднозначный запрос)* | UI с карточками воркфлоу для уточнения |

---

## Architecture in 6 bullets

1. Два канала входа: веб-приложение и Telegram-бот.
2. Все пользовательские запросы проходят через API-слой (`/api/orchestrate`, `/api/upload`, `/api/rag/query`, webhook Telegram).
3. Оркестратор параллельно запускает LLM-классификацию и keyword-fallback, затем выбирает intent и confidence.
4. Исполнитель вызывает один из 9 воркфлоу из реестра (`rag_qa`, `letter_generator`, `task_extractor`, и др.).
5. `rag_qa` и ingestion используют общий RAG-пайплайн: chunk → embeddings → pgvector retrieve → citations.
6. Инфраструктура: Supabase (PostgreSQL + pgvector), OpenAI (GPT-4o-mini/Whisper), Upstash Redis (кэш и rate limit).

**Подробно: [docs/architecture.md](docs/architecture.md)**.

---

## Технологический стек

| Слой | Технология |
|---|---|
| Фреймворк | Next.js 15 · App Router · Turbopack |
| Язык | TypeScript 5.7 (strict) |
| База данных | Supabase · PostgreSQL 15 · RLS |
| Векторный поиск | pgvector · косинусное сходство, 1536 измерений |
| LLM | OpenAI GPT-4o-mini (классификация + генерация) |
| Эмбеддинги | OpenAI text-embedding-3-small |
| Speech-to-Text | OpenAI Whisper |
| Кэш | Upstash Redis REST API (без SDK) |
| Стили | Tailwind CSS 3 + дизайн-система ВШЭ (CSS-переменные) |
| Мониторинг ошибок | Sentry |
| Бот | Telegram Bot API |
| Контейнер | Docker multi-stage build |

---

## Быстрый старт

### Docker (рекомендуется)

```bash
git clone https://github.com/your-org/studyflow-ai
cd studyflow-ai
cp .env.example .env.local   # заполнить все ключи

docker compose up --build
# → http://localhost:3000
```

### Локальная разработка

```bash
npm install
npm run dev    # Turbopack → http://localhost:3000
```

### Обязательные переменные окружения

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # только сервер, не публиковать
OPENAI_API_KEY=sk-...                          # только сервер
TELEGRAM_BOT_TOKEN=<bot token>                 # только сервер
TELEGRAM_WEBHOOK_SECRET=<случайный hex 32 байта>
```

Полный список с описанием — [.env.example](.env.example)

### Применение миграций БД

```bash
# Вариант 1 — Supabase CLI
npx supabase db push

# Вариант 2 — вручную (Supabase Dashboard → SQL Editor)
# Запустить файлы из supabase/migrations/ по порядку: 0001 → 0006
```

### Регистрация Telegram-вебхука (локально)

```bash
# Открыть публичный HTTPS-туннель
cloudflared tunnel --url http://localhost:3000

# Задать в .env.local: NEXT_PUBLIC_APP_URL=https://xxxx.trycloudflare.com
npx tsx scripts/setup-telegram-webhook.ts
```

---

## Структура проекта

```
├── app/
│   ├── (auth)/           # Вход · Регистрация · OAuth callback · Профиль
│   ├── (marketing)/      # Лендинг / страница воронки
│   ├── api/              # Route handlers — auth → валидация → сервис → JSON
│   │   ├── orchestrate/  # Главная точка входа
│   │   ├── upload/       # Асинхронная загрузка файлов
│   │   ├── rag/query/    # Семантический поиск с Redis-кэшем
│   │   ├── telegram/     # Вебхук с проверкой секрета
│   │   └── ...           # letters · tasks · quiz · planner · transcribe · analytics
│   └── dashboard/        # Ассистент · Документы · Лекции · Письма · Задачи · Аналитика
│
├── lib/
│   ├── orchestrator/     # Router · Classifier (LLM+KW) · Registry · Executor · Policies
│   ├── services/
│   │   ├── content/      # rag-qa · lecture-insight · explain · cheatsheet · quiz
│   │   ├── planning/     # tasks · planner
│   │   ├── communication/# letters
│   │   └── documents/    # ingestion (PDF/audio → chunk → embed) · transcribe
│   ├── rag/              # chunk · embed · retrieve · expand-query · citations
│   ├── ai/               # OpenAI client · prompts · retry · token-guard · schemas
│   ├── repository/       # Доступ к данным — auth · documents · letters · tasks
│   ├── integrations/     # YouTube транскрипты · HSE SmartLMS · iCalendar (RFC 5545)
│   ├── cache/            # Обёртка Upstash Redis (fetch-based, без SDK)
│   └── supabase/         # Клиенты browser + server · auth middleware
│
├── components/
│   ├── auth/             # AuthShell · GoogleSignInButton · LogoutButton
│   └── dashboard/        # SidebarNav · WorkflowPicker · HowItWorks · UI-примитивы
│
├── supabase/
│   ├── migrations/       # 0001_init → 0006_user_roles (9 таблиц + pgvector)
│   └── policies.sql      # Row Level Security политики
│
├── scripts/              # setup-telegram-webhook · grant-admin · ingest-documents · seed
├── docs/                 # Архитектура · БД · API · Оркестратор · RAG · ADR
├── Dockerfile            # 3 стадии: deps → builder → runner (node:22-alpine)
└── docker-compose.yml
```

---

## Краткий справочник API

Все endpoints требуют `Authorization: Bearer <supabase_jwt>`, кроме `/api/telegram/webhook`.

| Метод | Endpoint | Описание |
|---|---|---|
| `POST` | `/api/orchestrate` | Текст → классификация намерения → выполнение воркфлоу |
| `POST` | `/api/upload` | Загрузка PDF / TXT / аудио (асинхронная обработка) |
| `GET` | `/api/documents/:id/status` | Опрос статуса обработки документа |
| `POST` | `/api/rag/query` | Семантический вопрос-ответ по документам |
| `POST` | `/api/chat` | Диалоговый ассистент |
| `POST` | `/api/letters/generate` | Генерация официального письма |
| `POST` | `/api/tasks/extract` | Извлечение задач и дедлайнов |
| `POST` | `/api/quiz/generate` | Генерация тестовых вопросов |
| `POST` | `/api/cheatsheet/generate` | Генерация шпаргалки |
| `POST` | `/api/planner/build` | Составление учебного плана |
| `POST` | `/api/lecture-notes` | Конспект по транскрипту аудио |
| `POST` | `/api/transcribe` | Аудиофайл → текст (Whisper) |
| `POST` | `/api/transcribe/microphone` | Запись с микрофона браузера → текст |
| `POST` | `/api/telegram/webhook` | Обновления Telegram Bot |
| `POST` | `/api/analytics/event` | Запись события продуктовой аналитики |
| `GET` | `/api/health` | Health check |

Полные схемы запросов/ответов → [docs/api.md](docs/api.md)

---

## Документация

| Файл | Содержание |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Слои системы, компонентная диаграмма, архитектурные инварианты |
| [docs/orchestrator.md](docs/orchestrator.md) | Sequence diagram, стратегия классификации, политика confidence |
| [docs/database.md](docs/database.md) | ERD, описание таблиц, проектирование RLS |
| [docs/rag.md](docs/rag.md) | RAG-пайплайн, алгоритм чанкинга, стратегия эмбеддингов |
| [docs/api.md](docs/api.md) | Полный справочник API со схемами запросов/ответов |
| [docs/deployment.md](docs/deployment.md) | Docker, Vercel, настройка Telegram-вебхука, admin |
| [docs/adr/](docs/adr/) | Architecture Decision Records |

---

## Архитектурные инварианты

1. **Единый реестр** — добавление воркфлоу = одна запись в `lib/orchestrator/registry.ts`, больше ничего не меняется
2. **Сервисы без HTTP** — `lib/services/*` вызываются одинаково из route handler, Telegram-вебхука и CLI-скрипта
3. **Секреты только на сервере** — `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN` никогда не попадают в клиентский бандл
4. **Загрузка не блокирует** — `/api/upload` отвечает за <500 мс; чанкинг и эмбеддинги выполняются через `waitUntil()`
5. **Telegram всегда 200** — все ошибки логируются внутри; вебхук никогда не бросает исключение наружу
6. **RLS на всех пользовательских таблицах** — `service_role` клиент используется только в фоновых задачах

---

## Лицензия

MIT © 2025 StudyFlow AI
