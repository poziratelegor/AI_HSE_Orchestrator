# StudyFlow AI

AI-оркестратор для учебных задач: один вход на естественном языке, маршрутизация в workflow, единый API для Web и Telegram.

## Для чего этот репозиторий

Это **engineering starter**:
- каркас оркестратора и API уже работает;
- схема БД и миграции подготовлены;
- большая часть сервисной логики (`lib/services/*`, часть RAG, аналитика, Telegram handlers) пока в виде stub-реализаций.

Если вы начинаете работу в проекте впервые, стартуйте с:
1. этого README;
2. `product_v2.md` (продуктовые цели и ограничения);
3. `docs/architecture.md`.

---

## Текущее состояние (коротко)

| Область | Статус | Комментарий |
|---|---|---|
| Orchestrator (`lib/orchestrator/*`) | ✅ | Registry + rules-based классификация + fallback работают |
| API handlers (`app/api/*`) | ✅/⚠️ | Auth и базовая валидация есть; бизнес-логика частично stub |
| Supabase clients (`lib/supabase/client.ts`, `server.ts`) | ✅ | Рабочие клиенты для browser/server |
| Services (`lib/services/*`) | ⚠️ | В основном placeholder-ответы |
| RAG (`lib/rag/*`) | ⚠️ | Chunking базовый; embed/retrieve/citations не доведены |
| Telegram webhook | ⚠️ | Верификация секрета есть, обработчик обновлений не подключён |
| Analytics (`lib/analytics/*`) | ⚠️ | Каркас без полноценной записи/агрегаций |
| RLS policies (`supabase/policies.sql`) | ⚠️ | TODO, политики нужно дописать перед production |

---

## Быстрый старт

### 1) Требования
- Node.js 20+
- npm 10+
- Supabase project
- OpenAI API key

### 2) Установка

```bash
npm install
cp .env.example .env.local
```

### 3) Обязательные переменные

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
OPENAI_API_KEY=<openai_key>
```

### 4) Рекомендуемые переменные

```env
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
ORCHESTRATOR_CONFIDENCE_THRESHOLD=0.45
RAG_CHUNK_SIZE=512
RAG_CHUNK_OVERLAP=64
RAG_TOP_K=5
MAX_UPLOAD_SIZE_MB=20
INPUT_TEXT_RETENTION_DAYS=90
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

### 5) База данных

```bash
npx supabase db push
```

> `supabase/policies.sql` сейчас содержит TODO-комментарии. Для production требуется вручную добавить и применить RLS-политики.

### 6) Запуск

```bash
npm run dev
```

Приложение: `http://localhost:3000`.

---

## Основной runtime flow

```text
POST /api/orchestrate
  -> classifyIntent() через registry keywords
  -> confidence policy
  -> executeWorkflow() или fallback
  -> JSON ответ
```

Кодовые точки:
- `lib/orchestrator/router.ts`
- `lib/orchestrator/classify.ts`
- `lib/orchestrator/registry.ts`
- `lib/orchestrator/executor.ts`

---

## Структура репозитория

```text
app/                 # Next.js app router + API handlers
lib/orchestrator/    # intent classification, routing, execution
lib/services/        # workflow implementations (mostly stubs)
lib/rag/             # chunk/embed/retrieve/citations
lib/openai/          # OpenAI client + prompts/schemas
lib/supabase/        # Supabase client/server/middleware
lib/telegram/        # bot + handlers
lib/analytics/       # events/funnel/metrics
supabase/            # migrations, policies, seed
docs/                # technical docs
scripts/             # seed / ingest / backfill
```

---

## Команды разработки

```bash
npm run dev
npm run build
npm run lint
npx tsc --noEmit
npx tsx scripts/seed.ts
npx tsx scripts/ingest-documents.ts
npx tsx scripts/backfill-analytics.ts
```

---

## Навигация по документации

- `docs/architecture.md` — слои и архитектурные инварианты
- `docs/orchestrator.md` — логика маршрутизации и confidence policy
- `docs/api.md` — API контракты и ошибки
- `docs/database.md` — сущности и жизненные циклы данных
- `docs/deployment.md` — деплой и операционные проверки
- `docs/roadmap.md` — приоритеты реализации
- `docs/adr/*` — архитектурные решения

---

## Open questions / Assumptions

1. **Пороговая политика роутера**: в коде сейчас фактически бинарное поведение (execute/fallback), хотя документация описывает 3 зоны (`execute/recommend/clarify`).
2. **Upload pipeline**: endpoint пока принимает JSON-метаданные, а не multipart-файл; это допущение для scaffold-этапа.
3. **Telegram processing**: webhook подтверждает запрос, но бизнес-обработка update пока intentionally отключена.
4. **RLS**: считаем, что до production релиза политики будут реализованы отдельно в `supabase/policies.sql`.
