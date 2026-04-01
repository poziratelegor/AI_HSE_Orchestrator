create extension if not exists vector;

create table if not exists profiles (
  id uuid primary key,
  full_name text,
  email text,
  university text,
  faculty text,
  group_name text,
  course_number int,
  student_id text,
  telegram_user_id text,
  created_at timestamptz default now()
);

create table if not exists documents (
  id uuid primary key,
  user_id uuid,
  title text,
  file_path text,
  mime_type text,
  source_type text,
  processing_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists document_chunks (
  id uuid primary key,
  document_id uuid references documents(id) on delete cascade,
  chunk_text text not null,
  embedding vector(1536),
  chunk_index int,
  created_at timestamptz default now()
);

create table if not exists conversations (
  id uuid primary key,
  user_id uuid,
  channel text,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid primary key,
  conversation_id uuid references conversations(id) on delete cascade,
  role text,
  content text,
  created_at timestamptz default now()
);

create table if not exists orchestrator_runs (
  id uuid primary key,
  user_id uuid,
  input_text text,
  detected_intent text,
  confidence numeric,
  selected_workflow text,
  status text,
  created_at timestamptz default now()
);

create table if not exists workflow_results (
  id uuid primary key,
  orchestrator_run_id uuid references orchestrator_runs(id) on delete cascade,
  result_type text,
  result_json jsonb,
  created_at timestamptz default now()
);

create table if not exists tasks (
  id uuid primary key,
  user_id uuid,
  title text,
  description text,
  due_date timestamptz,
  status text,
  source_run_id uuid,
  created_at timestamptz default now()
);

create table if not exists analytics_events (
  id uuid primary key,
  user_id uuid,
  session_id text,
  event_name text not null,
  workflow text,
  intent_confidence numeric,
  channel text,
  duration_ms int,
  error_code text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
