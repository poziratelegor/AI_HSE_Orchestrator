# Database

## Основные сущности

### profiles
Профиль студента и данные для генерации писем.
- id
- full_name
- email
- university
- faculty
- group_name
- course_number
- student_id
- telegram_user_id
- created_at

### documents
Загруженные пользователем файлы.
- id
- user_id
- title
- file_path
- mime_type
- source_type
- processing_status
- created_at

### document_chunks
Чанки документов для RAG.
- id
- document_id
- chunk_text
- embedding
- chunk_index
- created_at

### conversations
Диалоги пользователя.
- id
- user_id
- channel
- created_at

### messages
Сообщения внутри диалога.
- id
- conversation_id
- role
- content
- created_at

### orchestrator_runs
Запуски маршрутизации.
- id
- user_id
- input_text
- detected_intent
- confidence
- selected_workflow
- status
- created_at

### workflow_results
Результат выполнения workflow.
- id
- orchestrator_run_id
- result_type
- result_json
- created_at

### tasks
Задачи и дедлайны.
- id
- user_id
- title
- description
- due_date
- status
- source_run_id
- created_at

### analytics_events
События продуктовой аналитики.
- id
- user_id
- session_id
- event_name
- workflow
- intent_confidence
- channel
- duration_ms
- error_code
- meta
- created_at

## Воронка продукта
- landing_view
- signup_complete
- first_query
- first_workflow_success
- repeat_usage

## Асинхронная обработка документов
Для документов и длинных лекций стоит хранить `processing_status` со значениями вроде:
- pending
- processing
- ready
- failed

Это позволяет не блокировать `/api/upload` на время чанкинга и embeddings.

## Дальше можно добавить
- reminders
- saved_outputs
- user_settings
- subscription / access plan
