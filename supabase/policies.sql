-- ============================================================
-- RLS Policies — StudyFlow AI
-- Apply after 0001_init.sql migration.
-- Service role (used in lib/supabase/server.ts) bypasses RLS by design;
-- these policies protect the `authenticated` role (direct client access).
-- ============================================================

-- Enable RLS
alter table profiles           enable row level security;
alter table documents          enable row level security;
alter table document_chunks    enable row level security;
alter table conversations      enable row level security;
alter table messages           enable row level security;
alter table orchestrator_runs  enable row level security;
alter table workflow_results   enable row level security;
alter table tasks               enable row level security;
alter table analytics_events   enable row level security;

-- ============================================================
-- profiles
-- PK id = auth.uid() (no separate user_id column)
-- ============================================================
create policy "profiles: select own"
  on profiles for select
  using (id = auth.uid());

create policy "profiles: insert own"
  on profiles for insert
  with check (id = auth.uid());

create policy "profiles: update own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- documents
-- direct: user_id = auth.uid()
-- ============================================================
create policy "documents: select own"
  on documents for select
  using (user_id = auth.uid());

create policy "documents: insert own"
  on documents for insert
  with check (user_id = auth.uid());

create policy "documents: update own"
  on documents for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "documents: delete own"
  on documents for delete
  using (user_id = auth.uid());

-- ============================================================
-- document_chunks
-- indirect: chunk → document.user_id = auth.uid()
-- NOTE: embedding ingestion (scripts/ingest-documents.ts) runs via
--       service role and is not affected by these policies.
-- ============================================================
create policy "document_chunks: select own"
  on document_chunks for select
  using (
    exists (
      select 1 from documents
      where documents.id = document_chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "document_chunks: insert own"
  on document_chunks for insert
  with check (
    exists (
      select 1 from documents
      where documents.id = document_chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

create policy "document_chunks: delete own"
  on document_chunks for delete
  using (
    exists (
      select 1 from documents
      where documents.id = document_chunks.document_id
        and documents.user_id = auth.uid()
    )
  );

-- ============================================================
-- conversations
-- direct: user_id = auth.uid()
-- ============================================================
create policy "conversations: select own"
  on conversations for select
  using (user_id = auth.uid());

create policy "conversations: insert own"
  on conversations for insert
  with check (user_id = auth.uid());

create policy "conversations: delete own"
  on conversations for delete
  using (user_id = auth.uid());

-- ============================================================
-- messages
-- indirect: message → conversation.user_id = auth.uid()
-- ============================================================
create policy "messages: select own"
  on messages for select
  using (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

create policy "messages: insert own"
  on messages for insert
  with check (
    exists (
      select 1 from conversations
      where conversations.id = messages.conversation_id
        and conversations.user_id = auth.uid()
    )
  );

-- ============================================================
-- orchestrator_runs
-- direct: user_id = auth.uid()
-- NOTE: rows are written server-side via service role during workflow
--       execution (/api/orchestrate). Policies guard authenticated role.
-- ============================================================
create policy "orchestrator_runs: select own"
  on orchestrator_runs for select
  using (user_id = auth.uid());

create policy "orchestrator_runs: insert own"
  on orchestrator_runs for insert
  with check (user_id = auth.uid());

-- ============================================================
-- workflow_results
-- indirect: result → orchestrator_run.user_id = auth.uid()
-- ============================================================
create policy "workflow_results: select own"
  on workflow_results for select
  using (
    exists (
      select 1 from orchestrator_runs
      where orchestrator_runs.id = workflow_results.orchestrator_run_id
        and orchestrator_runs.user_id = auth.uid()
    )
  );

create policy "workflow_results: insert own"
  on workflow_results for insert
  with check (
    exists (
      select 1 from orchestrator_runs
      where orchestrator_runs.id = workflow_results.orchestrator_run_id
        and orchestrator_runs.user_id = auth.uid()
    )
  );

-- ============================================================
-- tasks
-- direct: user_id = auth.uid()
-- ============================================================
create policy "tasks: select own"
  on tasks for select
  using (user_id = auth.uid());

create policy "tasks: insert own"
  on tasks for insert
  with check (user_id = auth.uid());

create policy "tasks: update own"
  on tasks for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "tasks: delete own"
  on tasks for delete
  using (user_id = auth.uid());

-- ============================================================
-- analytics_events
-- direct: user_id = auth.uid()
-- NOTE: scripts/backfill-analytics.ts runs via service role — not affected.
--       Anonymous/pre-auth events written server-side via service role only.
-- ============================================================
create policy "analytics_events: select own"
  on analytics_events for select
  using (user_id = auth.uid());

create policy "analytics_events: insert own"
  on analytics_events for insert
  with check (user_id = auth.uid());
