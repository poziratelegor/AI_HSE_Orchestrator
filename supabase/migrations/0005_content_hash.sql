-- Migration: 0005_content_hash
-- Adds supporting columns for new features:
--   - content_hash: deduplication in ingestion pipeline
--   - error_message on documents: already referenced in code, making it official
--   - token_count on document_chunks: used by token-guard
--   - page_number: future use for page-aware PDF processing
--   - section_heading: future use for heading-aware chunking
--
-- APPLY WITH:
--   npx supabase db push
--   OR run manually in Supabase SQL editor

ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS token_count int;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS page_number int;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS section_heading text;

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_documents_content_hash ON documents(content_hash)
  WHERE content_hash IS NOT NULL;

-- Index for chunk lookups by document
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id
  ON document_chunks(document_id);
