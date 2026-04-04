# Architecture

## Контекст

Проект — единое Next.js приложение с App Router, где в одном репозитории находятся:
- UI (marketing + dashboard);
- API handlers;
- оркестратор маршрутизации;
- интеграции (Supabase, OpenAI, Telegram);
- слой RAG и аналитики.

## Архитектурные слои

1. **Interface layer** (`app/*`, `components/*`)
   - страницы и UI-обвязка;
   - входные каналы: Web + Telegram webhook.

2. **API layer** (`app/api/*`)
   - валидация входа;
   - auth-check (кроме Telegram webhook);
   - вызов оркестратора/сервиса;
   - унифицированный формат ошибок.

3. **Orchestrator layer** (`lib/orchestrator/*`)
   - классификация intent;
   - выбор workflow;
   - fallback-поведение при низкой уверенности/ошибках.

4. **Workflow service layer** (`lib/services/*`)
   - бизнес-сценарии (письма, задачи, quiz, explain, и т.д.);
   - сейчас в основном stub-реализации.

5. **Knowledge layer (RAG)** (`lib/rag/*`, `app/api/upload`, `app/api/rag/query`)
   - подготовка документов (chunking / embeddings / retrieval / citations);
   - текущая реализация частичная.

6. **Data & integration layer** (`lib/supabase/*`, `supabase/*`, `lib/openai/*`, `lib/telegram/*`, `lib/analytics/*`)
   - хранилище данных, внешние API и телеметрия.

## Ключевые инварианты

- **Single entry point для маршрутизации**: новые пользовательские задачи должны проходить через оркестратор.
- **Registry-first расширяемость**: добавление workflow через `lib/orchestrator/registry.ts`, без разрастания `switch/case`.
- **Fail-safe поведение**: проблемы классификатора/сервиса не должны приводить к падению всего запроса.
- **Асинхронность длинных задач**: ingestion и тяжёлые RAG-операции не должны блокировать request-response цикл.
- **Server-only secrets**: секретные ключи не попадают в client bundle.

## Состояние реализации (архитектурные риски)

- Реестр и rules-based классификация уже работают.
- Значимая часть сервисов остаётся на уровне scaffold.
- RLS-политики не завершены.
- Telegram webhook подтверждает входящий вызов, но не обрабатывает апдейты в глубину.

Эти пункты важны для планирования ближайших задач и релизных ограничений.
