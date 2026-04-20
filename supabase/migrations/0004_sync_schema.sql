-- 0004_sync_schema.sql
-- Sync local migration history with the actual Supabase schema.
-- Covers: new tables, missing columns, check constraints, FK constraints,
-- RLS enable + policies, indexes.
-- Does NOT touch 0001–0003.

-- ============================================================
-- 1. ALTER existing tables: defaults, new columns, constraints
-- ============================================================

-- profiles ---------------------------------------------------
ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_course_number_check
    CHECK (course_number IS NULL OR (course_number >= 1 AND course_number <= 6));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);

-- documents --------------------------------------------------
ALTER TABLE public.documents
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS file_size_bytes   bigint,
  ADD COLUMN IF NOT EXISTS error_message     text;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_processing_status_check
    CHECK (processing_status = ANY (ARRAY['pending','processing','ready','failed'])),
  ADD CONSTRAINT documents_file_size_bytes_check
    CHECK (file_size_bytes > 0);

ALTER TABLE public.documents
  ADD CONSTRAINT documents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- document_chunks --------------------------------------------
ALTER TABLE public.document_chunks
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS metadata    jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS token_count int;

ALTER TABLE public.document_chunks
  ADD CONSTRAINT document_chunks_token_count_check CHECK (token_count > 0);

-- conversations ----------------------------------------------
ALTER TABLE public.conversations
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS title      text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_channel_check
    CHECK (channel = ANY (ARRAY['web','telegram']));

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- messages ---------------------------------------------------
ALTER TABLE public.messages
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.messages
  ADD CONSTRAINT messages_role_check
    CHECK (role = ANY (ARRAY['user','assistant','system']));

-- orchestrator_runs ------------------------------------------
ALTER TABLE public.orchestrator_runs
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS channel    text,
  ADD COLUMN IF NOT EXISTS latency_ms int;

ALTER TABLE public.orchestrator_runs
  ADD CONSTRAINT orchestrator_runs_status_check
    CHECK (status = ANY (ARRAY['running','completed','failed','fallback','clarification'])),
  ADD CONSTRAINT orchestrator_runs_channel_check
    CHECK (channel = ANY (ARRAY['web','telegram'])),
  ADD CONSTRAINT orchestrator_runs_latency_ms_check
    CHECK (latency_ms >= 0);

ALTER TABLE public.orchestrator_runs
  ADD CONSTRAINT orchestrator_runs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- workflow_results -------------------------------------------
ALTER TABLE public.workflow_results
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- tasks ------------------------------------------------------
ALTER TABLE public.tasks
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS priority   text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
    CHECK (status = ANY (ARRAY['pending','in_progress','done','cancelled'])),
  ADD CONSTRAINT tasks_priority_check
    CHECK (priority = ANY (ARRAY['low','medium','high','urgent']));

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id),
  ADD CONSTRAINT tasks_source_run_id_fkey
    FOREIGN KEY (source_run_id) REFERENCES public.orchestrator_runs(id);

-- analytics_events -------------------------------------------
ALTER TABLE public.analytics_events
  ALTER COLUMN id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN duration_ms TYPE bigint;

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_channel_check
    CHECK (channel IS NULL OR channel = ANY (ARRAY['web','telegram']));

ALTER TABLE public.analytics_events
  ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- ============================================================
-- 2. New tables
-- ============================================================

CREATE TABLE IF NOT EXISTS public.letters (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id),
  run_id         uuid        REFERENCES public.orchestrator_runs(id),
  subject        text        NOT NULL,
  body           text        NOT NULL,
  recipient_type text        CHECK (recipient_type = ANY (ARRAY['teacher','dean_office','admin','curator','other'])),
  status         text        NOT NULL DEFAULT 'draft'
                               CHECK (status = ANY (ARRAY['draft','ready','sent'])),
  source_prompt  text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_users (
  telegram_user_id text        PRIMARY KEY,
  user_id          uuid        REFERENCES auth.users(id),
  username         text,
  first_name       text,
  last_name        text,
  fsm_state        text        NOT NULL DEFAULT 'idle',
  fsm_context      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  last_active_at   timestamptz DEFAULT now(),
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_tags (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  tag         text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (document_id, tag)
);

-- ============================================================
-- 3. Enable RLS on all tables
-- ============================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_tags     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orchestrator_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies
-- ============================================================

-- profiles
CREATE POLICY "profiles: select own" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY "profiles: insert own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "profiles: update own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- documents
CREATE POLICY "documents: select own" ON public.documents
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "documents: insert own" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "documents: update own" ON public.documents
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "documents: delete own" ON public.documents
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- document_chunks
CREATE POLICY "document_chunks: select own" ON public.document_chunks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_chunks.document_id
      AND documents.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "document_chunks: insert own" ON public.document_chunks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_chunks.document_id
      AND documents.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "document_chunks: delete own" ON public.document_chunks
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_chunks.document_id
      AND documents.user_id = (SELECT auth.uid())
  ));

-- document_tags (open to public role — matches live DB)
CREATE POLICY "document_tags: select own" ON public.document_tags
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_tags.document_id
      AND documents.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "document_tags: insert own" ON public.document_tags
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_tags.document_id
      AND documents.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "document_tags: delete own" ON public.document_tags
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.documents
    WHERE documents.id = document_tags.document_id
      AND documents.user_id = (SELECT auth.uid())
  ));

-- conversations
CREATE POLICY "conversations: select own" ON public.conversations
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "conversations: insert own" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "conversations: delete own" ON public.conversations
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- messages
CREATE POLICY "messages: select own" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "messages: insert own" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = (SELECT auth.uid())
  ));

-- orchestrator_runs
CREATE POLICY "orchestrator_runs: select own" ON public.orchestrator_runs
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "orchestrator_runs: insert own" ON public.orchestrator_runs
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- workflow_results
CREATE POLICY "workflow_results: select own" ON public.workflow_results
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orchestrator_runs
    WHERE orchestrator_runs.id = workflow_results.orchestrator_run_id
      AND orchestrator_runs.user_id = (SELECT auth.uid())
  ));
CREATE POLICY "workflow_results: insert own" ON public.workflow_results
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orchestrator_runs
    WHERE orchestrator_runs.id = workflow_results.orchestrator_run_id
      AND orchestrator_runs.user_id = (SELECT auth.uid())
  ));

-- tasks
CREATE POLICY "tasks: select own" ON public.tasks
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "tasks: insert own" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "tasks: update own" ON public.tasks
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "tasks: delete own" ON public.tasks
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- analytics_events
CREATE POLICY "analytics_events: select own" ON public.analytics_events
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "analytics_events: insert own" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

-- letters (open to public role — matches live DB)
CREATE POLICY "letters: select own" ON public.letters
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "letters: insert own" ON public.letters
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "letters: update own" ON public.letters
  FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "letters: delete own" ON public.letters
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- telegram_users (open to public role — matches live DB)
CREATE POLICY "telegram_users: select own" ON public.telegram_users
  FOR SELECT USING (user_id = (SELECT auth.uid()));

-- ============================================================
-- 5. Indexes
-- ============================================================

-- profiles
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_user_id_unique
  ON public.profiles (telegram_user_id) WHERE telegram_user_id IS NOT NULL;

-- documents
CREATE INDEX IF NOT EXISTS idx_documents_user_id
  ON public.documents (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id_status
  ON public.documents (user_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at
  ON public.documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_pending_processing
  ON public.documents (user_id, created_at DESC)
  WHERE processing_status = ANY (ARRAY['pending','processing']);

-- document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON public.document_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw
  ON public.document_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- document_tags
CREATE INDEX IF NOT EXISTS idx_document_tags_document_id
  ON public.document_tags (document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag
  ON public.document_tags (tag);

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON public.conversations (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_updated_at
  ON public.conversations (user_id, updated_at DESC);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at
  ON public.messages (conversation_id, created_at);

-- orchestrator_runs
CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_user_id
  ON public.orchestrator_runs (user_id);
CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_user_id_created_at
  ON public.orchestrator_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_created_at
  ON public.orchestrator_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_workflow
  ON public.orchestrator_runs (selected_workflow, created_at DESC)
  WHERE selected_workflow IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orchestrator_runs_channel
  ON public.orchestrator_runs (channel, created_at DESC)
  WHERE channel IS NOT NULL;

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_user_id
  ON public.tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_created_at
  ON public.tasks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id_status
  ON public.tasks (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at
  ON public.tasks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON public.tasks (user_id, due_date)
  WHERE due_date IS NOT NULL AND status <> 'done' AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS idx_tasks_source_run_id
  ON public.tasks (source_run_id)
  WHERE source_run_id IS NOT NULL;

-- analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
  ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id_created_at
  ON public.analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
  ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
  ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_workflow
  ON public.analytics_events (workflow, created_at DESC)
  WHERE workflow IS NOT NULL;

-- letters
CREATE INDEX IF NOT EXISTS idx_letters_user_id
  ON public.letters (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_letters_user_id_status
  ON public.letters (user_id, status);

-- telegram_users
CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id
  ON public.telegram_users (user_id)
  WHERE user_id IS NOT NULL;

-- workflow_results
CREATE INDEX IF NOT EXISTS idx_workflow_results_orchestrator_run_id
  ON public.workflow_results (orchestrator_run_id);
