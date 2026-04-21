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
```

Подробнее о структуре: `docs/dev-structure.md`.

---

## Краткий справочник API

Все endpoints требуют `Authorization: Bearer <supabase_jwt>`, кроме `/api/telegram/webhook`.

| Метод | Endpoint | Описание |
|---|---|---|
| `POST` | `/api/orchestrate` | Текст → классификация намерения → выполнение воркфлоу |
| `POST` | `/api/upload` | Загрузка PDF / TXT / аудио (асинхронная обработка) |
| `GET` | `/api/documents/:id/status` | Опрос статуса обработки документа |
| `POST` | `/api/telegram/webhook` | Обновления Telegram Bot |
| `GET` | `/api/health` | Health check |

**Полный API: [docs/api.md](docs/api.md)**

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


## Лицензия

MIT © 2025 StudyFlow AI
