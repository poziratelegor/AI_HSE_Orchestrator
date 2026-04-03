# Orchestrator

## Роль оркестратора
Оркестратор — это слой маршрутизации.
Он не должен генерировать конечный пользовательский результат сам, если это можно делегировать отдельному workflow.

## Основной flow
1. принять пользовательский input
2. нормализовать входные данные
3. определить intent
4. оценить confidence
5. запустить workflow или вернуть route recommendation
6. сохранить лог выполнения

## Доступные workflows
- lecture_insight
- rag_qa
- letter_generator
- task_extractor
- study_plan
- explain_this
- cheat_sheet
- quiz_generator
- route_recommender

## Реестр workflow
Для MVP оркестратор использует registry-based подход.
Добавление нового сценария должно происходить через одну запись в `lib/orchestrator/registry.ts`, без переписывания router и executor.

Каждая запись описывает:
- имя workflow
- keywords
- минимальный confidence
- requiredInputs
- handler

## Политика выбора
- confidence >= 0.75 → выполнять сценарий
- 0.45 <= confidence < 0.75 → рекомендовать маршрут
- confidence < 0.45 → просить уточнение или делать fallback

## Первая реализация
Для MVP можно начать с гибридного подхода:
- rules-based routing на базе реестра
- затем LLM classifier со structured output
- fallback на route_recommender, если классификация падает или confidence низкий

## Fallback и устойчивость
Если structured output невалиден, модель недоступна или классификатор падает, оркестратор не должен ломать весь запрос.
В этом случае используется fallback на `route_recommender` или вопрос на уточнение.

## Что логировать
- исходный текст
- attachments
- detected intent
- confidence
- reason
- selected workflow
- execution status
- latency
