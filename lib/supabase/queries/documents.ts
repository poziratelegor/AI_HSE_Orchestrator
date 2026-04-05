import { getSupabaseServerClient } from "@/lib/supabase/server";

export type DocumentRow = {
  id: string;
  title: string | null;
  mime_type: string | null;
  processing_status: string | null;
  file_size_bytes: number | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export async function getUserDocuments(userId: string): Promise<DocumentRow[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, mime_type, processing_status, file_size_bytes, error_message, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load documents: ${error.message}`);
  }

  return (data ?? []) as DocumentRow[];
}
