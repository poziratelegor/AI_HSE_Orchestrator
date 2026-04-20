# Deployment

## Целевая платформа

- Application runtime: **Vercel**
- Database/Auth/Storage: **Supabase**
- Optional channel: **Telegram Bot API**

## Production ветка

- `main` — целевая ветка деплоя (через Vercel integration).

## Обязательные переменные окружения

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

Опционально (если включён Telegram):
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

## Базовый чеклист релиза

1. Применить миграции Supabase (`npx supabase db push`).
2. Убедиться, что env-переменные заданы в Vercel.
3. Проверить сборку (`npm run build`) до merge в `main`.
4. После деплоя проверить health критичных endpoint'ов:
   - `/api/orchestrate`
   - `/api/telegram/webhook` (если используется)
5. Проверить, что секреты не попали в репозиторий.

## Telegram webhook

Для локальной отладки:

```bash
cloudflared tunnel --url http://localhost:3000
```

Регистрация webhook:

```bash
curl https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://<tunnel>.trycloudflare.com/api/telegram/webhook \
  -d secret_token=$TELEGRAM_WEBHOOK_SECRET
```

На API-слое должен проверяться заголовок `x-telegram-bot-api-secret-token`.

## Operational notes

- Upload/RAG ingestion должен быть асинхронным (очередь, background job, `waitUntil()` или эквивалент).
- RLS-политики обязательны до production запуска с реальными пользовательскими данными.

## Open questions / Assumptions

1. Пока считаем Vercel единственным production-рантаймом; multi-cloud сценарии не покрываются.
2. Rollback-процедура для миграций не формализована в этом документе.
3. Для очередей фоновой обработки финальный стек (Vercel/Edge Function/external queue) ещё не закреплён.
