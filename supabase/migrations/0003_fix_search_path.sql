-- Fix: set explicit search_path on match_document_chunks to address
-- "function_search_path_mutable" security advisory.
-- vector extension is in public schema, so search_path = public is required.

create or replace function match_document_chunks(
  query_embedding vector(1536),
  match_threshold  float,
  match_count      int,
  p_user_id        uuid
)
returns table (
  id             uuid,
  document_id    uuid,
  chunk_text     text,
  chunk_index    int,
  similarity     float,
  document_title text
)
language sql stable
set search_path = public
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity,
    coalesce(d.title, 'Документ')          as document_title
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  where
    d.user_id = p_user_id
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
