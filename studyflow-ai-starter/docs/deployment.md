# Deployment

## Платформа
Vercel

## Production branch
main

## Переменные окружения
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- OPENAI_API_KEY
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET

## Шаги деплоя
1. Создать проект в Supabase
2. Создать проект в Vercel и привязать GitHub-репозиторий
3. Добавить environment variables
4. Залить код в `main`
5. Проверить Vercel deployment
6. Настроить Telegram webhook на публичный URL

## Telegram webhook
Для локальной разработки можно использовать tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

После этого зарегистрируй webhook:

```bash
curl https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d url=https://your-tunnel.trycloudflare.com/api/telegram/webhook \
  -d secret_token=$TELEGRAM_WEBHOOK_SECRET
```

На стороне route handler нужно проверять заголовок:
- `x-telegram-bot-api-secret-token`

## Асинхронная обработка документов
Для продакшен-версии загрузку документа лучше делать в два этапа:
1. быстро принять файл и создать запись в `documents`
2. отдельно запустить чанкинг, embeddings и индексацию

Варианты:
- Vercel `waitUntil()`
- очередь задач
- Supabase Edge Function

## Потенциальные проблемы
- забыты env vars
- bot token хранится в репозитории
- webhook указывает не на тот URL
- RAG не работает без чанкинга и embeddings
- маршрутизация слишком неопределённая без нормального classifier
