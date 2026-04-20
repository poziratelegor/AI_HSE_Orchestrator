-- Колонки для идемпотентности Telegram-уведомлений о дедлайнах.
-- notified_24h_at — проставляется когда отправлено уведомление за ~24 часа до дедлайна.
-- notified_1h_at  — проставляется когда отправлено уведомление за ~1 час до дедлайна.
alter table public.tasks
  add column if not exists notified_24h_at timestamptz,
  add column if not exists notified_1h_at  timestamptz;

comment on column public.tasks.notified_24h_at is 'Время отправки Telegram-уведомления за 24 часа до дедлайна';
comment on column public.tasks.notified_1h_at  is 'Время отправки Telegram-уведомления за 1 час до дедлайна';

-- Индекс для cron-воркера: нужны только задачи с дедлайном в будущем, не завершённые.
create index if not exists idx_tasks_due_date_active
  on public.tasks (due_date)
  where status <> 'done' and status <> 'cancelled' and due_date is not null;
