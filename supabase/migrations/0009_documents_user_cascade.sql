-- Ensure user deletion cascades to documents, and then to document_chunks/document_tags.
-- This prevents orphaned data for document-related tables.

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_user_id_fkey;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
