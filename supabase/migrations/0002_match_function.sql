-- match_document_chunks
-- Vector similarity search filtered to a specific user's documents.
-- Uses cosine distance (<=>). Requires pgvector extension (enabled in 0001_init.sql).
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
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_text,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity,
    coalesce(d.title, 'Документ')          as document_title
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where
    d.user_id = p_user_id
    and dc.embedding is not null
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
