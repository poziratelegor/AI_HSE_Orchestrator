# Backlog — StudyFlow AI

Задачи, которые не были реализованы в текущей итерации.
Причины указаны для каждого пункта.

---

## 🎓 HSE-специфичные интеграции

### C.2 — HSE OAuth SSO (вход через @edu.hse.ru)
- **Что даёт:** Студенты входят через корпоративный аккаунт HSE, не нужна отдельная регистрация
- **Как реализовать:** Microsoft Azure AD OAuth2; tenant = `hse.ru`
- **Env vars:** `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID=hse.ru`
- **Блокер:** Нужно зарегистрировать приложение в Azure AD у HSE IT. Писать на it@hse.ru или portal.hse.ru/iit
- **Сложность:** Medium — Next.js Auth.js + Microsoft provider

### C.3 — ЕЛК API (оценки, учебный план, пересдачи)
- **Что даёт:** Получать оценки, расписание сессий, учебный план прямо из ЕЛК
- **Блокер:** Публичного API не существует. lk.hse.ru использует внутренний REST без документации. HSE App (iOS/Android) использует тот же закрытый API
- **Путь:** Официальное партнёрство с НИУ ВШЭ или запрос через it@hse.ru
- **Альтернатива:** User-side scraping через browser extension (не рекомендуется)

### C.4 — HSE Timetable API (timetable.hse.ru)
- **Что даёт:** Расписание занятий в задачи/напоминания
- **Блокер:** Неофициальный JSON endpoint, нет документации, нестабилен
- **Частичное решение:** Уже реализован iCal импорт (B.3) — timetable.hse.ru экспортирует .ics

### C.5 — Антиплагиат интеграция
- **Блокер:** Платный B2B сервис (antiplagiat.ru), API только для вузов по договору

---

## 🔌 Внешние интеграции (требуют доп. работы)

### B.4 — Google Drive импорт
- **Что даёт:** Импортировать документы прямо из Google Drive
- **Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (console.cloud.google.com)
- **Блокер:** Требует OAuth 2.0 flow (redirect URI), сложнее чем REST-только интеграции
- **Сложность:** High — нужен OAuth consent screen, хранение refresh tokens в Supabase

### B.5 — Notion импорт
- **Что даёт:** Конспекты из Notion → RAG база знаний
- **Env vars:** `NOTION_TOKEN` (notion.so/my-integrations)
- **Сложность:** Medium — Notion API хорошо задокументирован, но требует user-specific tokens

### B.6 — Telegram напоминания о дедлайнах
- **Что даёт:** Бот пишет студенту за 24ч до дедлайна из SmartLMS/iCal
- **Env vars:** `TELEGRAM_BOT_TOKEN` (уже есть)
- **Блокер:** Нужен scheduler/cron. Варианты: Vercel Cron Jobs, Supabase pg_cron, внешний сервис
- **Сложность:** Medium

---

## 🛡️ Надёжность (требуют миграции БД или npm пакетов)

### A.8 — Sentry мониторинг (полная интеграция)
- **Что добавить:** `npm install @sentry/nextjs`, `sentry.client.config.ts`, `sentry.server.config.ts`
- **Env vars:** `SENTRY_DSN` (sentry.io → Create Project)
- **Статус:** Логгер уже настроен с заглушкой Sentry в `lib/logger.ts` — работает сразу после установки пакета

### D.2 — Постраничная обработка PDF + page_number в чанке
- **Что даёт:** «Это описано на странице 47» в ответах
- **Блокер:** Нужна миграция: `ALTER TABLE document_chunks ADD COLUMN page_number int`
- **Миграция готова к применению:** `supabase/migrations/0005_content_hash.sql` (см. ниже)

---

## 🎨 UI/UX (отдельная итерация, требует апрув)

- **4.1** Streaming ответов в Assistant (SSE)
- **4.2** Drag & drop загрузка файлов с progress bar
- **4.3** Inline цитаты в RAG ответах ([1] → раскрывающаяся сноска)
- **4.4** История диалога в Assistant (chat-лента)
- **4.5** Toast-уведомления
- **4.6** Skeleton loaders
- **4.7** Адаптивный сайдбар (drawer на мобайле)
- **4.8** Пустые состояния с CTA на каждой странице

---

## 📊 Качество RAG (требуют миграции или внешних сервисов)

- **1.1** Hybrid search (dense + BM25 через `pg_trgm`) — нужна миграция + индекс
- **1.2** Section heading в чанках — нужна миграция: `ALTER TABLE document_chunks ADD COLUMN section_heading text`
- **1.4** Reranking через cross-encoder — нужен внешний сервис (Cohere Rerank API или self-hosted)

---

## Pending миграции (применять вручную после апрува)

```sql
-- Файл: supabase/migrations/0005_content_hash.sql
-- Добавить content_hash на documents + page_number на document_chunks

ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS token_count int;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_number int;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS section_heading text;

CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
```
