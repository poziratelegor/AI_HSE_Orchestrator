# Деплой

## Локальная разработка

```bash
npm install
npm run dev    # http://localhost:3000 (Turbopack)
```

Проверки после изменений:
```bash
npx tsc --noEmit   # типизация
npm run lint       # линтинг
npm run build      # полная сборка для прода
```

---

## Docker (локально)

### Сборка и запуск

```bash
# Первый раз или после изменений кода
docker compose up --build

# В фоне
docker compose up --build -d

# Остановить
docker compose down

# Логи
docker compose logs -f web
```

Приложение доступно по адресу **http://localhost:3000**.

### Проверка работоспособности

```bash
curl http://localhost:3000/api/health
# → { "ok": true, "ts": 1713098400000 }
```

### Как работает Dockerfile

```
Стадия 1 — deps (node:22-alpine)
  npm ci --ignore-scripts → node_modules

Стадия 2 — builder (node:22-alpine)
  npm run build → .next/standalone + .next/static

Стадия 3 — runner (node:22-alpine)
  Копируется только standalone-бандл (~50 МБ против ~500 МБ полного)
  Запуск от непривилегированного пользователя (uid 1001)
  CMD ["node", "server.js"]
```

`output: "standalone"` в `next.config.ts` обеспечивает упаковку только необходимых файлов — `node_modules` в продовый образ не попадает.

---

## Vercel (прод)

### Деплой

```bash
npm install -g vercel
vercel --prod
```

Или подключить GitHub-репозиторий в дашборде Vercel — деплой будет автоматическим при каждом пуше.

### Переменные окружения

Добавить все переменные из `.env.local` в Vercel → Settings → Environment Variables.

**Важно:** `SUPABASE_SERVICE_ROLE_KEY` и `OPENAI_API_KEY` должны быть **только серверными** (не видимыми браузеру). Vercel по умолчанию держит все переменные серверными, если они не начинаются с `NEXT_PUBLIC_`.

### Таймаут функций

Задаётся в `vercel.json` (создать если нет):
```json
{
  "functions": {
    "app/api/transcribe/route.ts":  { "maxDuration": 60 },
    "app/api/upload/route.ts":      { "maxDuration": 30 },
    "app/api/orchestrate/route.ts": { "maxDuration": 30 }
  }
}
```

Hobby-план: макс. 10 с. Pro-план: макс. 60 с.

### Supabase Auth: критичные настройки email/magic-link

Если не приходят письма подтверждения или magic-link «не работает», проверьте именно эти пункты:

1. **Auth → URL Configuration**
   - `Site URL`: канонический прод-домен (например, `https://ai-hse-orchestrator.vercel.app`).
   - `Redirect URLs`: должны включать:
     - `https://ai-hse-orchestrator.vercel.app/auth/callback`
     - `https://ai-hse-orchestrator.vercel.app/callback`
     - локальную разработку (`http://localhost:3000/auth/callback`, `http://localhost:3000/callback`)
2. **Auth → Email**
   - Включён провайдер email (Supabase default или custom SMTP).
   - Нет блокировки/лимита на отправку в используемом плане.
3. **Vercel env**
   - `NEXT_PUBLIC_APP_URL` должен указывать на тот же канонический домен, что и `Site URL`.

Важно: если пользователь открывает preview-домен Vercel, а Supabase настроен на прод-домен, сессия и redirect могут «расходиться» по разным origin.

---

## Миграции базы данных

### Вариант А — Supabase CLI (рекомендуется)

```bash
# Установка
npm install -g supabase

# Вход
supabase login

# Привязка к проекту
supabase link --project-ref yhtxedumkfwfigqqxmrg

# Применить все ожидающие миграции
npx supabase db push
```

### Вариант Б — вручную (Dashboard SQL Editor)

Запустить файлы миграций по порядку из `supabase/migrations/`:

```
0001_init.sql            — Все 9 таблиц, расширение pgvector
0002_match_function.sql  — RPC match_document_chunks()
0003_fix_search_path.sql
0004_sync_schema.sql
0005_content_hash.sql
0006_user_roles.sql
```

### Применить RLS-политики

После миграций запустить `supabase/policies.sql` в SQL Editor.

---

## Telegram-вебхук

### Регистрация вебхука

```bash
# 1. Задать NEXT_PUBLIC_APP_URL публичным URL (не localhost)
#    Для локальной разработки использовать туннель (см. ниже)

# 2. Запустить скрипт настройки
npx tsx scripts/setup-telegram-webhook.ts

# Вывод:
# ✓ Вебхук установлен: https://your-url.com/api/telegram/webhook
# ✓ Бот: @hse_ai_bot (StudyFlow AI)
# ✓ Ожидающих обновлений: 0
```

### Проверка Telegram меню

После запуска `scripts/setup-telegram-webhook.ts` скрипт автоматически:

1. Регистрирует webhook.
2. Устанавливает команды бота (`/start`, `/help`, `/link`) для `default` и локали `ru`.
3. Пытается установить кнопку меню `web_app` со ссылкой на `NEXT_PUBLIC_APP_URL` (опционально).

Проверить вручную можно через Bot API:

```bash
# Команды по умолчанию
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMyCommands"

# Команды для русской локали
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMyCommands" \
  -H "Content-Type: application/json" \
  -d '{"language_code":"ru"}'

# Кнопка меню
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getChatMenuButton"
```

Ожидаемо:
- в списке команд есть `start`, `help`, `link` с русскими описаниями;
- `getChatMenuButton` возвращает `web_app` (или `default`, если Telegram не принял кастомную кнопку — это не критично).

### Локальный туннель (для разработки)

```bash
# Вариант А — cloudflared (без аккаунта)
cloudflared tunnel --url http://localhost:3000
# → https://xxxx.trycloudflare.com

# Вариант Б — ngrok
ngrok http 3000
# → https://xxxx.ngrok.io
```

Задать `NEXT_PUBLIC_APP_URL=https://xxxx.trycloudflare.com` в `.env.local`, затем повторно зарегистрировать вебхук.

### Безопасность вебхука

Вебхук проверяет `X-Telegram-Bot-Api-Secret-Token` при каждом запросе. Сгенерировать надёжный секрет:

```bash
openssl rand -hex 32
```

Задать как `TELEGRAM_WEBHOOK_SECRET` в переменных окружения.

---

## Настройка администратора

### Выдать роль admin

```bash
npx tsx scripts/grant-admin.ts your@email.com
```

Пользователи с ролью admin получают доступ к `/dashboard/analytics` и агрегированным данным воронки.

### Через SQL (Supabase Dashboard)

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your@email.com';
```

---

## Сид-данные

```bash
# Инициализация тестовых документов и пользователей
npx tsx scripts/seed.ts

# Массовый инжест документов из папки /data
npx tsx scripts/ingest-documents.ts
```

---

## Справочник переменных окружения

### Обязательные

| Переменная | Описание |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Публичный URL приложения (используется для Telegram-вебхука) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon-ключ Supabase (безопасен для браузера) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role ключ — **только сервер** |
| `OPENAI_API_KEY` | API-ключ OpenAI — **только сервер** |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота — **только сервер** |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет для проверки вебхука — **только сервер** |

### Опциональные (со значениями по умолчанию)

| Переменная | По умолчанию | Описание |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `openai` \| `anthropic-compat` \| `custom` |
| `OPENAI_MODEL` | `gpt-4o-mini` | LLM-модель для генерации |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Модель эмбеддингов |
| `UPSTASH_REDIS_REST_URL` | — | URL Redis (кэш отключается если не задан) |
| `UPSTASH_REDIS_REST_TOKEN` | — | Auth-токен Redis |
| `SENTRY_DSN` | — | DSN Sentry для отслеживания ошибок |
| `RESEND_API_KEY` | — | Email-провайдер для уведомлений |
| `NEXT_PUBLIC_TELEGRAM_BOT_URL` | — | Ссылка на Telegram-бот в интерфейсе |
| `NEXT_PUBLIC_CONTACT_EMAIL` | — | Email поддержки в интерфейсе |
| `MAX_UPLOAD_SIZE_MB` | `20` | Максимальный размер загружаемого файла |
| `RAG_CHUNK_SIZE` | `800` | Размер чанка в токенах |
| `RAG_TOP_K` | `5` | Максимум чанков на один запрос |

---

## Мониторинг

- **Sentry** — все необработанные ошибки в route handlers перехватываются автоматически
- **`/api/health`** — использовать для мониторинга доступности (Uptime Robot, Better Uptime)
- **Таблица `orchestrator_runs`** — запросы для перцентилей латентности и частоты ошибок
- **Таблица `analytics_events`** — метрики продуктовой воронки

Пример запроса:

```sql
-- P95 латентность оркестратора за последние 7 дней
SELECT
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
  COUNT(*) AS total_runs,
  COUNT(*) FILTER (WHERE status = 'error') AS errors
FROM orchestrator_runs
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Диагностика доставки analytics events (Vercel Logs)

`trackEvent` работает в fail-soft режиме: ошибка аналитики не прерывает пользовательский запрос, но в логах появляются структурированные маркеры.

- `ANALYTICS_DELIVERY_WARN` — временная ошибка доставки, включился retry.
- `ANALYTICS_DELIVERY_ERROR` — все retry-итерации исчерпаны или ошибка не временная.

Для быстрой фильтрации в Vercel:

1. Открыть **Vercel → Project → Logs**.
2. Фильтр по строке `ANALYTICS_DELIVERY_WARN` или `ANALYTICS_DELIVERY_ERROR`.
3. Проверить структурированные поля в записи:
   - `eventName`
   - `userId`
   - `workflow`
   - `attempt`
   - `errorCode`

Если видите рост `ANALYTICS_DELIVERY_ERROR`, проверьте:
- доступность Supabase (`NEXT_PUBLIC_SUPABASE_URL`, ключи, egress);
- наличие массовых таймаутов/сетевых сбоев у serverless-функций;
- корректность `channel/workflow/meta` у вызывающих API-роутов (для сегментации и поиска в логах).
