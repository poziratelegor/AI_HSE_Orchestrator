# API

## Аутентификация

Все API-роуты (кроме `POST /api/telegram/webhook`) требуют авторизации.

**Заголовок:**
```
Authorization: Bearer <supabase_access_token>
```

Токен получается через Supabase JS-клиент:
```typescript
const { data: { session } } = await supabase.auth.getSession();
// session.access_token → передать в Authorization header
```

При отсутствии токена или истечении сессии сервер возвращает `401`.

---

## Формат ошибок

Все ошибки имеют единый формат:

```json
{
  "ok": false,
  "error": "error_code",
  "message": "Человекочитаемое описание."
}
```

| HTTP статус | `error` | Когда |
|-------------|---------|-------|
| `401` | `unauthorized` | Нет токена или токен недействителен |
| `400` | `invalid_input` | Отсутствует обязательное поле или неверный тип |
| `500` | `internal_error` | Ошибка на стороне сервера |

---

## POST /api/orchestrate

Главная точка входа в оркестратор.

### Request
```json
{
  "text": "Напиши письмо преподавателю о переносе дедлайна",
  "channel": "web",
  "attachments": []
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `text` | string | ✅ | Непустая строка запроса пользователя |
| `channel` | `"web"` \| `"telegram"` | — | По умолчанию `"web"` |
| `attachments` | array | — | По умолчанию `[]` |

### Response `200`
```json
{
  "ok": true,
  "channel": "web",
  "intent": "letter_generator",
  "confidence": 0.82,
  "reason": "Найден сигнал для workflow letter_generator: письм",
  "result": {
    "ok": true,
    "workflow": "letter_generator",
    "summary": "Official letter placeholder",
    "data": {
      "subject": "Официальное обращение",
      "body": "..."
    }
  }
}
```

---

## POST /api/upload

Приём документа для RAG-индексирования. **Не блокирует** — обработка асинхронна.

### Request
```json
{
  "title": "Лекция по математическому анализу",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `title` | string | ✅ | Название документа |
| `mimeType` | string | ✅ | Один из: `application/pdf`, `text/plain`, `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/ogg` |
| `sizeBytes` | number | — | Размер файла в байтах (проверяется лимит `MAX_UPLOAD_SIZE_MB`) |

### Response `200`
```json
{
  "ok": true,
  "documentId": "uuid",
  "status": "pending",
  "message": "Документ принят в обработку."
}
```

---

## POST /api/rag/query

Вопрос по загруженным материалам пользователя.

### Request
```json
{
  "question": "Что такое интеграл Римана?"
}
```

### Response `200`
```json
{
  "ok": true,
  "workflow": "rag_qa",
  "answer": "...",
  "sources": [
    { "documentId": "uuid", "chunkIndex": 3, "excerpt": "..." }
  ]
}
```

---

## POST /api/transcribe

Транскрипция аудио через Whisper.

### Request
```json
{
  "audioUrl": "https://...",
  "documentId": "uuid"
}
```

Необходимо передать хотя бы одно из полей: `audioUrl` или `documentId`.

---

## POST /api/chat

Диалоговый интерфейс поверх оркестратора.

### Request
```json
{
  "message": "Объясни теорему Пифагора",
  "conversationId": "uuid"
}
```

---

## POST /api/letters/generate

Прямой вызов workflow `letter_generator` (минуя оркестратор).

### Request
```json
{
  "text": "Прошу перенести срок сдачи курсовой работы на две недели"
}
```

---

## POST /api/tasks/extract

Прямой вызов workflow `task_extractor`.

### Request
```json
{
  "text": "До пятницы сдать реферат, до 20-го — лабораторную работу №3"
}
```

---

## POST /api/planner/build

Прямой вызов workflow `study_plan`.

### Request
```json
{
  "text": "Экзамен по квантовой механике через 10 дней, пройдено 3 из 8 тем"
}
```

---

## POST /api/cheatsheet/generate

Прямой вызов workflow `cheat_sheet`.

### Request
```json
{
  "text": "Интегралы: основные формулы и методы интегрирования"
}
```

---

## POST /api/quiz/generate

Прямой вызов workflow `quiz_generator`.

### Request
```json
{
  "text": "Тема: электромагнитная индукция",
  "questionCount": 10
}
```

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `text` | string | ✅ | Тема или исходный материал |
| `questionCount` | number | — | Целое число от 1 до 50 |

---

## POST /api/analytics/event

Логирование продуктового события.

### Request
```json
{
  "eventName": "first_workflow_success",
  "channel": "web"
}
```

---

## POST /api/telegram/webhook

**Не требует Supabase-авторизации.** Аутентификация — через заголовок `x-telegram-bot-api-secret-token`.

Всегда возвращает `200 OK` (требование Telegram).

### Response `200`
```json
{ "ok": true }
```

Неверный secret-token → `401 { "ok": false, "error": "unauthorized" }`.
