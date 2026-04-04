# Roadmap

## Принцип приоритизации

Сначала закрываем риски безопасности и базовую работоспособность user flow, затем расширяем функциональность.

## Phase 0 — Stabilization (ближайший приоритет)

1. RLS-политики в `supabase/policies.sql`.
2. Довести auth-flow и middleware до production-готовности.
3. Завершить реализацию критичных workflow:
   - `letter_generator`
   - `task_extractor`
   - `rag_qa` (минимально рабочий контур)
4. Подключить реальную запись аналитики (`analytics_events`).
5. Завершить webhook processing для Telegram.

## Phase 1 — MVP completion

- Assistant UI с устойчивым UX и обработкой ошибок.
- Upload pipeline (multipart/file storage + async processing).
- RAG retrieval + citations с понятным форматом источников.
- Базовые дашборды usage/funnel.

## Phase 2 — Learning workflows expansion

- `explain_this`
- `cheat_sheet`
- `study_plan`
- `quiz_generator`
- напоминания в Telegram

## Phase 3 — Scale & quality

- Улучшенная аналитика (latency, success rate, cohort view).
- Улучшение качества retrieval и citation UX.
- Фоновые jobs и контроль SLA для длинных задач.
- Возможные collaborative сценарии (если подтвердится продуктовая потребность).

## Open questions / Assumptions

1. Порядок реализации workflow внутри Phase 1/2 может меняться по результатам пользовательских интервью.
2. Внедрение LLM-классификатора запланировано после стабилизации rules-based baseline.
3. Production readiness не считается достигнутой без RLS и асинхронного ingestion-контура.
