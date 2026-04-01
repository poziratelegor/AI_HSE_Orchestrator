# Architecture

## Подход
Проект строится как единый monorepo на Next.js.
В одном приложении находятся:
- лендинг
- авторизация
- dashboard
- assistant UI
- API route handlers
- Telegram webhook

## Основные слои
1. UI layer — страницы и компоненты
2. Orchestrator layer — классификация intent и выбор workflow
3. Service layer — отдельные сценарии
4. Knowledge layer — загрузка файлов, чанкинг, embeddings, retrieval
5. Data layer — Supabase Auth, Postgres, Storage, аналитика

## Ключевые принципы
- один основной вход через оркестратор
- workflow описываются через реестр, а не через разрастающийся switch-case
- длинные задачи по документам обрабатываются асинхронно
- аналитика событий и воронки хранится в БД
