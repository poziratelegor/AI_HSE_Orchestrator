# База данных

## Обзор

PostgreSQL 15 через Supabase с расширением `pgvector` для семантического поиска.

- **9 таблиц** — все пользовательские данные защищены Row Level Security
- **1536-мерные** векторы эмбеддингов (OpenAI text-embedding-3-small)
- **Косинусное сходство** через RPC-функцию `match_document_chunks()`

---

## Диаграмма сущностей (ERD)

```mermaid
erDiagram
    profiles {
        uuid    id           PK  "ссылка на auth.users"
        text    name
        text    email
        text    university
        text    telegram_id
        text    role             "user | admin, по умолчанию: user"
        timestamptz created_at
    }

    documents {
        uuid    id           PK
        uuid    user_id      FK
        text    title
        text    mime_type
        text    storage_path
        int     file_size_bytes
        text    processing_status  "pending|processing|ready|partial|failed"
        text    error_message
        text    content_hash       "SHA-256, дедупликация"
        timestamptz created_at
        timestamptz updated_at
    }

    document_chunks {
        uuid    id           PK
        uuid    document_id  FK
        int     chunk_index
        text    chunk_text
        vector  embedding        "1536-мерный, косинус"
        timestamptz created_at
    }

    conversations {
        uuid    id       PK
        uuid    user_id  FK
        text    title
        timestamptz created_at
    }

    messages {
        uuid    id               PK
        uuid    conversation_id  FK
        text    role             "user | assistant"
        text    content
        jsonb   metadata
        timestamptz created_at
    }

    orchestrator_runs {
        uuid    id           PK
        uuid    user_id      FK
        text    input_text
        text    intent
        float   confidence
        text    workflow
        text    status       "success | fallback | error"
        int     latency_ms
        text    channel      "web | telegram"
        timestamptz created_at
    }

    workflow_results {
        uuid    id       PK
        uuid    run_id   FK
        uuid    user_id  FK
        text    workflow
        jsonb   result
        timestamptz created_at
    }

    tasks {
        uuid    id          PK
        uuid    user_id     FK
        text    title
        text    description
        date    due_date
        text    status      "pending | done"
        text    source      "text | document | telegram"
        timestamptz created_at
    }

    analytics_events {
        uuid    id          PK
        uuid    user_id     FK  "null — события до авторизации"
        text    event_name
        jsonb   properties
        timestamptz created_at
    }

    profiles       ||--o{ documents          : "владеет"
    profiles       ||--o{ conversations      : "имеет"
    profiles       ||--o{ orchestrator_runs  : "инициирует"
    profiles       ||--o{ tasks              : "имеет"
    profiles       ||--o{ analytics_events   : "генерирует"
    profiles       ||--o{ workflow_results   : "получает"
    documents      ||--o{ document_chunks    : "разбит на"
    conversations  ||--o{ messages           : "содержит"
    orchestrator_runs ||--o{ workflow_results : "порождает"
```

---

## Справочник таблиц

### `profiles`
Идентичность пользователя, связана с `auth.users` через триггер при регистрации.

| Колонка | Тип | Описание |
|---|---|---|
| `id` | `uuid` | Совпадает с `auth.users.id` |
| `name` | `text` | Отображаемое имя |
| `email` | `text` | От OAuth-провайдера |
| `university` | `text` | Опционально — ВШЭ или другой вуз |
| `telegram_id` | `text` | ID в Telegram для привязки бота |
| `role` | `text` | `user` \| `admin` (по умолчанию: `user`) |

---

### `documents`
Метаданные файла. Обработка происходит асинхронно после загрузки.

| Колонка | Тип | Описание |
|---|---|---|
| `processing_status` | `text` | Конечный автомат — см. ниже |
| `content_hash` | `text` | SHA-256 байт файла — предотвращает повторную загрузку |
| `error_message` | `text` | Устанавливается при статусе `failed` или `partial` |
| `storage_path` | `text` | Путь в Supabase Storage |

**Конечный автомат статусов обработки:**

```mermaid
stateDiagram-v2
    [*] --> pending : POST /api/upload\nОтвечает немедленно

    pending --> processing : Запуск фоновой задачи\nпайплайн chunk + embed

    processing --> ready    : Все чанки успешно\nзаэмбеддены
    processing --> partial  : Частичная ошибка —\nнекоторые batch-вставки провалились
    processing --> failed   : Критическая ошибка\n(повреждённый файл / таймаут)

    ready   --> [*] : Доступно для RAG\nполное качество
    partial --> [*] : Доступно для RAG\nсниженное качество
    failed  --> [*] : Установлен error_message\nпользователь уведомлён

    note right of processing
        1. Извлечение текста (pdf-parse / Whisper)
        2. chunkText() → chunks[]
        3. embedBatchSafe() → vectors[]
        4. INSERT INTO document_chunks
    end note
```

---

### `document_chunks`
Текстовые сегменты с 1536-мерными эмбеддингами. Используются для поиска по pgvector.

| Колонка | Тип | Описание |
|---|---|---|
| `chunk_index` | `int` | Позиция в документе, начиная с 0 |
| `chunk_text` | `text` | Исходный текст, ~800 токенов |
| `embedding` | `vector(1536)` | OpenAI text-embedding-3-small |

Индекс: `HNSW` по `embedding` для быстрого косинусного поиска.

---

### `orchestrator_runs`
Журнал аудита каждого решения по классификации и маршрутизации.

| Колонка | Тип | Описание |
|---|---|---|
| `input_text` | `text` | Исходный запрос пользователя (обрезан до 500 символов) |
| `intent` | `text` | Имя классифицированного воркфлоу |
| `confidence` | `float4` | 0.0 – 1.0 |
| `workflow` | `text` | Выполненный воркфлоу (null при fallback) |
| `status` | `text` | `success` \| `fallback` \| `error` |
| `latency_ms` | `int` | Время end-to-end в мс |
| `channel` | `text` | `web` \| `telegram` |

Используется для дашборда аналитики и мониторинга качества модели.

---

### `analytics_events`
Телеметрия продуктовой воронки. Записывается через `trackEvent()`.

| Событие | Когда | Свойства |
|---|---|---|
| `landing_view` | Открыта главная страница | `{ source, utm_* }` |
| `signup_complete` | Создан пользователь | `{ provider }` |
| `first_query` | Первый вызов оркестратора | `{ channel }` |
| `first_workflow_success` | Первый успешный запуск | `{ workflow }` |
| `document_uploaded` | Файл принят | `{ mime_type, size_bytes }` |
| `document_ready` | Эмбеддинг завершён | `{ chunk_count, latency_ms }` |
| `rag_query` | RAG-поиск выполнен | `{ cached, result_count }` |
| `repeat_usage` | 5-я сессия | `{ days_since_signup }` |

---

## RPC-функция векторного поиска

Определена в `supabase/migrations/0002_match_function.sql`:

```sql
CREATE FUNCTION match_document_chunks(
  query_embedding  vector(1536),
  match_threshold  float,
  match_count      int,
  p_user_id        uuid
)
RETURNS TABLE (
  id              uuid,
  document_id     uuid,
  chunk_text      text,
  chunk_index     int,
  similarity      float,
  document_title  text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.title AS document_title
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE d.user_id = p_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

---

## Row Level Security

На всех пользовательских таблицах включён RLS. Политики в `supabase/policies.sql`:

```
profiles        SELECT / UPDATE WHERE id = auth.uid()
documents       ALL WHERE user_id = auth.uid()
document_chunks SELECT WHERE document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
conversations   ALL WHERE user_id = auth.uid()
messages        ALL WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
orchestrator_runs SELECT WHERE user_id = auth.uid()
workflow_results  SELECT WHERE user_id = auth.uid()
tasks           ALL WHERE user_id = auth.uid()
analytics_events  INSERT (пользователь может писать), SELECT WHERE user_id = auth.uid()
```

Обход для администратора: `profiles.role = 'admin'` — разрешён SELECT по `analytics_events` без фильтра по user_id.

---

## Миграции

| Файл | Изменения |
|---|---|
| `0001_init.sql` | Все 9 таблиц, расширение pgvector, индексы |
| `0002_match_function.sql` | RPC `match_document_chunks()` |
| `0003_fix_search_path.sql` | Исправление `search_path` для безопасности |
| `0004_sync_schema.sql` | Синхронизация схемы после сброса Supabase |
| `0005_content_hash.sql` | Колонка `content_hash` в `documents` |
| `0006_user_roles.sql` | Колонка `role` в `profiles` |

Применить: `npx supabase db push` или запустить файлы по порядку в Dashboard → SQL Editor.
