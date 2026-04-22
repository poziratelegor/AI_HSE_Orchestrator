import { getSupabaseServerClient } from "@/lib/supabase/server";

export const TELEGRAM_AUTH_GENERIC_FAILURE_MESSAGE =
  "Не удалось подтвердить данные. Проверьте введённые данные или обратитесь в поддержку.";
export const TELEGRAM_AUTH_SUPPORT_MESSAGE =
  "Не удалось подтвердить данные. Обратитесь в поддержку.";

export function normalizeTelegramAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeTelegramAuthFullName(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

type SupabaseLike = {
  from: (table: string) => {
    select: (columns: string) => {
      ilike: (column: string, value: string) => Promise<{
        data: Array<{ id: string; full_name: string | null; email: string | null }> | null;
        error: { message: string } | null;
      }>;
    };
  };
};

export type TelegramProfileAuthResult =
  | { ok: true; userId: string }
  | {
      ok: false;
      reason: "not_found_or_mismatch" | "duplicate_email" | "db_error";
      message: string;
    };

/**
 * Server-side верификация пользователя Telegram по email + ФИО.
 *
 * Безопасность:
 * - внешнее сообщение единое для cases "email не найден" и "ФИО не совпал";
 * - при дублях email (legacy-данные) доступ не выдаём: логируем и просим обратиться в поддержку.
 */
export async function findTelegramUserByEmailAndFullName(
  email: string,
  fullName: string,
  opts?: { supabase?: SupabaseLike }
): Promise<TelegramProfileAuthResult> {
  const supabase = opts?.supabase ?? getSupabaseServerClient();

  const normalizedEmail = normalizeTelegramAuthEmail(email);
  const normalizedFullName = normalizeTelegramAuthFullName(fullName);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .ilike("email", normalizedEmail);

  if (error) {
    console.error("[telegram/auth] profiles lookup error", { message: error.message });
    return { ok: false, reason: "db_error", message: TELEGRAM_AUTH_SUPPORT_MESSAGE };
  }

  const candidates = (data ?? []).filter((row) => {
    if (!row.email) return false;
    return normalizeTelegramAuthEmail(row.email) === normalizedEmail;
  });

  if (candidates.length !== 1) {
    if (candidates.length > 1) {
      console.error("[telegram/auth] duplicate profiles by email", {
        normalizedEmail,
        candidateIds: candidates.map((row) => row.id),
      });
      return { ok: false, reason: "duplicate_email", message: TELEGRAM_AUTH_SUPPORT_MESSAGE };
    }

    return {
      ok: false,
      reason: "not_found_or_mismatch",
      message: TELEGRAM_AUTH_GENERIC_FAILURE_MESSAGE,
    };
  }

  const matched = candidates[0];
  const normalizedProfileName = normalizeTelegramAuthFullName(matched.full_name ?? "");
  if (normalizedProfileName !== normalizedFullName) {
    return {
      ok: false,
      reason: "not_found_or_mismatch",
      message: TELEGRAM_AUTH_GENERIC_FAILURE_MESSAGE,
    };
  }

  return { ok: true, userId: matched.id };
}
