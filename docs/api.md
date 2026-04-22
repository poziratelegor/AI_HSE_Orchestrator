# Справочник API

## Общие правила

**Базовый URL:** `http://localhost:3000` (разработка) или `NEXT_PUBLIC_APP_URL` (прод)

**Аутентификация:** Все endpoints требуют `Authorization: Bearer <supabase_jwt>`, кроме:
- `POST /api/telegram/webhook` — проверяется заголовком `X-Telegram-Bot-Api-Secret-Token`
- `GET /api/health` — публичный

**Конверт ответа:**

```typescript
// Успех
{ ok: true, ...payload }

// Ошибка
{ ok: false, error: "код_ошибки", message: "Описание для пользователя" }
```

**Типичные коды ошибок:**

| Код | HTTP | Значение |
|---|---|---|
| `unauthorized` | 401 | Отсутствует или невалидный JWT |
| `invalid_input` | 400 | Отсутствующее или неверного типа поле |
| `not_found` | 404 | Ресурс не существует или принадлежит другому пользователю |
| `rate_limited` | 429 | Слишком много запросов |
| `classification_failed` | 500 | Внутренняя ошибка оркестратора |
| `service_error` | 500 | Сервис воркфлоу выбросил ошибку |

---

## Endpoints

### `POST /api/orchestrate`

Главная точка входа. Классифицирует намерение и направляет в соответствующий воркфлоу.

**Запрос:**
```json
{
  "text": "Найди в моих конспектах что Кейнс говорил про спрос",
  "channel": "web",
  "attachments": []
}
```

**Ответ (успех — воркфлоу выполнен):**
```json
{
  "ok": true,
  "workflow": "rag_qa",
  "intent": "rag_qa",
  "confidence": 0.91,
  "reason": "Пользователь попросил найти информацию в материалах",
  "needsClarification": false,
  "result": { ... }
}
```

**Ответ (низкий confidence — нужно уточнение):**
```json
{
  "ok": true,
  "intent": "route_recommender",
  "confidence": 0.38,
  "needsClarification": true,
  "clarificationQuestion": "Уточни, что именно тебе нужно...",
  "suggestions": ["rag_qa", "explain_this", "cheat_sheet"]
}
```

---

### `POST /api/upload`

Загрузить документ для асинхронной обработки. Отвечает немедленно — обработка идёт в фоне.

**Запрос:** `multipart/form-data`

| Поле | Тип | Описание |
|---|---|---|
| `file` | File | PDF, TXT, MP3, MP4, WAV, OGG, WebM — макс. 20 МБ |
| `title` | string | Отображаемое название (опционально, по умолчанию — имя файла) |

Проверяется: MIME-тип + magic bytes (PDF: `%PDF`, MP3: ID3/sync bits, OGG: `OggS`)

**Ответ:**
```json
{
  "ok": true,
  "documentId": "uuid",
  "message": "Принят в обработку"
}
```

**Статус обработки:** опрашивать через `GET /api/documents/:id/status`

---

### `GET /api/documents/:id/status`

Опрос статуса обработки документа.

**Ответ:**
```json
{
  "ok": true,
  "id": "uuid",
  "status": "ready",
  "chunkCount": 42,
  "error": null
}
```

Значения `status`: `pending` | `processing` | `ready` | `partial` | `failed`

---

### `POST /api/rag/query`

Семантический поиск по загруженным документам пользователя.

**Запрос:**
```json
{
  "query": "что такое эффективный спрос по Кейнсу?"
}
```

**Ответ:**
```json
{
  "ok": true,
  "answer": "По Кейнсу, эффективный спрос — это...",
  "citations": [
    {
      "documentTitle": "Макроэкономика лекция 3.pdf",
      "excerpt": "...эффективный спрос определяется как точка пересечения...",
      "chunkIndex": 7,
      "similarity": 0.87
    }
  ],
  "cached": false
}
```

Ответы кэшируются в Redis на 1 час (ключ: `rag:{userId}:{sha256(query)}`).

---

### `POST /api/chat`

Диалоговый ассистент. Поддерживает контекст сессии через `conversationId`.

**Запрос:**
```json
{
  "message": "А расскажи подробнее про мультипликатор",
  "conversationId": "uuid-or-null"
}
```

**Ответ:**
```json
{
  "ok": true,
  "reply": "Мультипликатор Кейнса показывает...",
  "conversationId": "uuid"
}
```

---

### `POST /api/letters/generate`

Генерация официального письма.

**Запрос:**
```json
{
  "type": "leave_request",
  "details": "Прошу предоставить академический отпуск с 01.09.2025 по причине...",
  "recipient": "Декану факультета экономики"
}
```

**Ответ:**
```json
{
  "ok": true,
  "letter": "Декану факультета экономики\n\nЗаявление\n\nПрошу..."
}
```

---

### `POST /api/tasks/extract`

Извлечение структурированных задач и дедлайнов из произвольного текста.

**Запрос:**
```json
{
  "text": "Сдать курсовую до 15 мая, защита диплома 20 июня, коллоквиум по микро в пятницу"
}
```

**Ответ:**
```json
{
  "ok": true,
  "tasks": [
    { "title": "Сдать курсовую работу", "dueDate": "2025-05-15", "source": "text" },
    { "title": "Защита диплома",        "dueDate": "2025-06-20", "source": "text" },
    { "title": "Коллоквиум по микро",   "dueDate": "2025-04-18", "source": "text" }
  ]
}
```

---

### `POST /api/quiz/generate`

Генерация тестовых вопросов по тексту.

**Запрос:**
```json
{
  "text": "Теория игр изучает стратегическое взаимодействие...",
  "count": 5,
  "type": "mcq"
}
```

**Ответ:**
```json
{
  "ok": true,
  "questions": [
    {
      "question": "Что изучает теория игр?",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correct": "B"
    }
  ]
}
```

---

### `POST /api/cheatsheet/generate`

Генерация плотной шпаргалки по тексту.

**Запрос:**
```json
{ "text": "...", "maxLength": 500 }
```

**Ответ:**
```json
{
  "ok": true,
  "cheatsheet": "**Теория игр**\n• Доминирующая стратегия: ...\n• Равновесие Нэша: ..."
}
```

---

### `POST /api/planner/build`

Составление учебного плана.

**Запрос:**
```json
{
  "topic": "Подготовка к экзамену по макроэкономике",
  "daysAvailable": 14,
  "hoursPerDay": 3
}
```

**Ответ:**
```json
{
  "ok": true,
  "plan": [
    { "day": 1, "topic": "Национальный доход и ВВП", "tasks": ["..."] }
  ]
}
```

---

### `POST /api/lecture-notes`

Генерация структурированного конспекта по транскрипту аудио.

**Запрос:**
```json
{
  "transcript": "Сегодня мы рассмотрим модель IS-LM..."
}
```

**Ответ:**
```json
{
  "ok": true,
  "notes": {
    "title": "Модель IS-LM",
    "summary": "...",
    "keyPoints": ["...", "..."],
    "definitions": [{ "term": "IS-кривая", "definition": "..." }],
    "actionItems": ["Прочитать главу 8", "..."]
  }
}
```

---

### `POST /api/transcribe`

Транскрипция аудиофайла через OpenAI Whisper.

**Запрос:** `multipart/form-data`

| Поле | Тип | Описание |
|---|---|---|
| `audio` | File | MP3, WAV, OGG, WebM, M4A |
| `language` | string | Опционально, ISO 639-1, например `ru` |

**Ответ:**
```json
{ "ok": true, "transcript": "Текст лекции..." }
```

---

### `POST /api/transcribe/microphone`

Транскрипция записи с микрофона браузера (Blob от MediaRecorder).

**Запрос:** `multipart/form-data`

| Поле | Тип | Описание |
|---|---|---|
| `audio` | Blob | WebM или OGG от MediaRecorder |

**Ответ:**
```json
{ "ok": true, "transcript": "Что ты сказал..." }
```

---

### `POST /api/telegram/webhook`

Обрабатывает входящие обновления Telegram Bot. Аутентификация по JWT не требуется.

**Безопасность:** `X-Telegram-Bot-Api-Secret-Token: <TELEGRAM_WEBHOOK_SECRET>` — возвращает 403, если отсутствует или неверный.

**Запрос:** объект Telegram `Update` (JSON)

**Ответ:** всегда `{ ok: true }` — даже при ошибке (предотвращение повторных попыток Telegram).

Поддерживаемые типы обновлений:
- `message.text` — маршрутизируется через оркестратор
- `message.voice` — скачивается → Whisper → оркестратор
- `message.document` + caption — загружается + caption как запрос
- `callback_query` — безопасно маршрутизируется по whitelist payload:
  - `help`
  - `relink`
  - `scenario:ask_question`
  - `scenario:upload_document`
  - для всех callback выполняется `answerCallbackQuery` (ack), неизвестные payload отклоняются

---

### `POST /api/analytics/event`

Запись события продуктовой воронки.

**Запрос:**
```json
{
  "event": "document_uploaded",
  "properties": { "mime_type": "application/pdf", "size_bytes": 204800 }
}
```

**Ответ:**
```json
{ "ok": true }
```

---

### `GET /api/health`

Health check. Аутентификация не требуется.

**Ответ:**
```json
{ "ok": true, "ts": 1713098400000 }
```
