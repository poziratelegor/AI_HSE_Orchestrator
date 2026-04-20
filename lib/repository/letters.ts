import { getSupabaseServerClient } from "@/lib/supabase/server";

export type LetterRow = {
  id: string;
  subject: string | null;
  body: string | null;
  recipient_type: string | null;
  status: string | null;
  created_at: string | null;
};

export async function getUserLetters(userId: string): Promise<LetterRow[]> {
  const supabase = getSupabaseServerClient();

  const { data, error } = await supabase
    .from("letters")
    .select("id, subject, body, recipient_type, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to load letters: ${error.message}`);
  }

  return (data ?? []) as LetterRow[];
}
