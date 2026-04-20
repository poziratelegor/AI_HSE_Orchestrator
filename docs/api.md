# API

## Общие правила

- Формат: JSON request/response.
- Auth: все endpoint'ы требуют Supabase access token, **кроме** `POST /api/telegram/webhook`.
- Header для авторизации:

```http
Authorization: Bearer <supabase_access_token>
```

- Единый формат ошибок:

```json
{
  "ok": false,
  "error": "invalid_input",
  "message": "Человекочитаемое описание"
}
```

### Типовые коды ошибок

| HTTP | `error` | Смысл |
|---|---|---|
| 400 | `invalid_input` | Невалидный или неполный payload |
| 401 | `unauthorized` | Нет валидной авторизации |
| 500 | `internal_error` | Ошибка на стороне сервера |

---

## Endpoint'ы

### `POST /api/orchestrate`
Главная точка маршрутизации пользовательского текста.

**Request**
```json
{
  "text": "Напиши письмо преподавателю о переносе дедлайна",
  "channel": "web",
  "attachments": []
}
```

Поля:
- `text` (string, required)
- `channel` (`web | telegram`, optional, default `web`)
- `attachments` (array, optional)

---

### `POST /api/upload`
Принимает метаданные документа для асинхронной обработки.

> Текущий scaffold: endpoint валидирует поля и возвращает `pending`, но не сохраняет файл и не запускает реальный ingestion pipeline.

**Request**
```json
{
  "title": "Лекция по матанализу",
  "mimeType": "application/pdf",
  "sizeBytes": 1048576
}
```

---

### `POST /api/rag/query`
Вопрос по пользовательским материалам (workflow `rag_qa`).

**Request**
```json
{
  "question": "Что такое интеграл Римана?"
}
```

---

### `POST /api/transcribe`
Транскрипция аудио (scaffold).

**Request**
```json
{
  "audioUrl": "https://...",
  "documentId": "uuid"
}
```

Нужно передать хотя бы одно поле: `audioUrl` или `documentId`.

---

### `POST /api/chat`
Диалоговый интерфейс поверх оркестратора.

### `POST /api/letters/generate`
Прямой вызов `letter_generator`.

### `POST /api/tasks/extract`
Прямой вызов `task_extractor`.

### `POST /api/planner/build`
Прямой вызов `study_plan`.

### `POST /api/cheatsheet/generate`
Прямой вызов `cheat_sheet`.

### `POST /api/quiz/generate`
Прямой вызов `quiz_generator`.

`questionCount` — optional, integer от 1 до 50.

### `POST /api/analytics/event`
Логирование продуктового события.

---

### `POST /api/telegram/webhook`
- Не использует Supabase auth.
- Проверяет заголовок `x-telegram-bot-api-secret-token`.
- При успешной верификации отвечает `200 { "ok": true }`.

> Важно: Telegram ожидает быстрый `200 OK`; бизнес-обработка update не должна ломать ack-механику.

---

## Open questions / Assumptions

1. Контракты прямых workflow endpoint'ов пока считаются временными, т.к. сервисы в основном stub.
2. Для `/api/upload` задокументирован текущий JSON-scaffold, а не финальный multipart API.
3. Поведение `/api/chat` и `/api/transcribe` будет уточняться после фактического подключения OpenAI/Whisper логики.
