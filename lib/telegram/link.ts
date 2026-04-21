/**
 * Telegram ↔ Supabase account linking via short-lived OTP.
 *
 * Flow:
 *   1. Пользователь нажимает «Привязать Telegram» в /dashboard/profile
 *      → POST /api/profile/telegram-link → generateLinkCode(userId) →
 *        возвращаем code + deep-link `https://t.me/<bot>?start=link_<code>`
 *   2. Пользователь нажимает на ссылку → Telegram открывает бота с
 *      `/start link_<code>` → handler вызывает consumeLinkCode(code, tgId)
 *      → ставит telegram_users.user_id, чистит код в profiles.
 *
 * Код живёт 15 минут. Каждый запрос на новый код — перезаписывает старый.
 */

import { getSupabaseServerClient } from "@/lib/supabase/server";

const CODE_TTL_MS = 15 * 60 * 1000; // 15 минут
const CODE_LENGTH = 8;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I/L

function generateCode(): string {
  let s = "";
  // crypto.getRandomValues есть и в Node 20+ и в edge runtime
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return s;
}

export interface LinkCodeResult {
  code: string;
  expiresAt: string;
  deepLink: string;
  botUsername: string | null;
}

/**
 * Генерирует код и сохраняет его в profiles.telegram_link_code.
 * Возвращает deep-link, который пользователь откроет в Telegram.
 */
export async function generateLinkCode(userId: string): Promise<LinkCodeResult> {
  const supabase = getSupabaseServerClient();
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({
      telegram_link_code: code,
      telegram_link_expires_at: expiresAt,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Не удалось сохранить код привязки: ${error.message}`);
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") ?? null;
  const deepLink = botUsername
    ? `https://t.me/${botUsername}?start=link_${code}`
    : `https://t.me/?start=link_${code}`;

  return { code, expiresAt, deepLink, botUsername };
}

export type ConsumeLinkResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "not_found" | "expired" | "db_error"; message: string };

/**
 * Проверяет код, если валидный — связывает telegram_users.user_id с profile.
 * Идемпотентна по telegramUserId (upsert), код стирается после успеха.
 */
export async function consumeLinkCode(
  code: string,
  telegramUserId: number,
  tgProfile?: { username?: string; first_name?: string; last_name?: string }
): Promise<ConsumeLinkResult> {
  const supabase = getSupabaseServerClient();

  const { data: profile, error: lookupErr } = await supabase
    .from("profiles")
    .select("id, telegram_link_expires_at")
    .eq("telegram_link_code", code)
    .maybeSingle();

  if (lookupErr) {
    return { ok: false, reason: "db_error", message: lookupErr.message };
  }
  if (!profile) {
    return { ok: false, reason: "not_found", message: "Код не найден или уже использован." };
  }

  const exp = profile.telegram_link_expires_at as string | null;
  if (exp && new Date(exp).getTime() < Date.now()) {
    return { ok: false, reason: "expired", message: "Срок действия кода истёк." };
  }

  // Upsert telegram_users
  const { error: upsertErr } = await supabase.from("telegram_users").upsert(
    {
      telegram_user_id: String(telegramUserId),
      user_id: profile.id,
      username: tgProfile?.username ?? null,
      first_name: tgProfile?.first_name ?? null,
      last_name: tgProfile?.last_name ?? null,
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "telegram_user_id" }
  );

  if (upsertErr) {
    return { ok: false, reason: "db_error", message: upsertErr.message };
  }

  // Clear code (single-use)
  await supabase
    .from("profiles")
    .update({ telegram_link_code: null, telegram_link_expires_at: null })
    .eq("id", profile.id);

  return { ok: true, userId: profile.id };
}

/**
 * Разбирает payload `/start link_<CODE>` или `/start <CODE>`. Возвращает code или null.
 */
export function parseStartLinkPayload(text: string): string | null {
  // /start link_ABC123XY  или  /start ABC123XY
  const m = text.match(/^\/start(?:@\w+)?(?:\s+(?:link_)?([A-Z0-9]{6,16}))?/i);
  return m && m[1] ? m[1].toUpperCase() : null;
}
