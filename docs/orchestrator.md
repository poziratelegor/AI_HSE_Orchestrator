# Orchestrator

## Роль

Оркестратор отвечает за маршрутизацию пользовательского запроса в подходящий workflow.
Он не должен содержать тяжёлую бизнес-логику конкретных сценариев.

## Runtime flow

1. Получить входные данные (`text`, `channel`, `attachments`, `userId`).
2. Классифицировать intent (`classifyIntent`).
3. Применить confidence policy.
4. Либо выполнить workflow (`executeWorkflow`), либо вернуть fallback/clarification.
5. Вернуть унифицированный JSON-ответ.

## Зарегистрированные workflow

- `lecture_insight`
- `rag_qa`
- `letter_generator`
- `task_extractor`
- `study_plan`
- `explain_this`
- `cheat_sheet`
- `quiz_generator`
- `route_recommender`

## Registry-based подход

Единственная точка расширения — `lib/orchestrator/registry.ts`.

Каждая запись содержит:
- `name`
- `keywords`
- `minConfidence`
- `requiredInputs`
- `run` handler

Это позволяет добавлять новый сценарий без переписывания router/executor.

## Confidence policy

Целевая политика:
- `confidence >= 0.75` → выполнить workflow;
- `0.45 <= confidence < 0.75` → рекомендовать маршрут/уточнение;
- `confidence < 0.45` → fallback.

## Текущее состояние реализации

- Классификатор — rules-based по keyword matching.
- При совпадении keywords обычно возвращается `minConfidence` выбранного workflow.
- При отсутствии совпадения используется `route_recommender` с низким confidence.

Практический нюанс: текущая логика роутера ориентируется на порог `recommend` (0.45), поэтому промежуточная зона 0.45–0.74 пока не имеет отдельной ветки поведения.

## Отказоустойчивость

При ошибке классификации должен возвращаться fallback, а не crash запроса.

Рекомендуемый минимум логирования для `orchestrator_runs`:
- input text (с retention-политикой)
- detected intent
- confidence
- selected workflow
- status
- latency

## Open questions / Assumptions

1. Нужна отдельная ветка поведения для диапазона 0.45–0.74 после включения LLM-классификатора.
2. Формат clarification-вопросов пока не стандартизован для всех каналов.
3. Детальные аудиты маршрутизации (reason traces) пока не сохраняются в БД.
