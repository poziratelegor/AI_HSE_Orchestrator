# API

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

### Response
```json
{
  "ok": true,
  "channel": "web",
  "intent": "letter_generator",
  "confidence": 0.82,
  "reason": "В запросе есть явный признак генерации официального письма.",
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

## Другие эндпоинты
- `POST /api/chat`
- `POST /api/upload`
- `POST /api/transcribe`
- `POST /api/rag/query`
- `POST /api/tasks/extract`
- `POST /api/letters/generate`
- `POST /api/planner/build`
- `POST /api/cheatsheet/generate`
- `POST /api/quiz/generate`
- `POST /api/analytics/event`
- `POST /api/telegram/webhook`
