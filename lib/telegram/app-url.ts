import { getCanonicalAppUrl } from "@/lib/supabase/redirect-url";

const LOCAL_FALLBACK_BASE = "http://localhost:3000";

export type TelegramCtaLinks = {
  signupUrl: string;
  profileUrl: string;
  hasCanonicalUrl: boolean;
};

/**
 * Базовые CTA-ссылки для Telegram.
 * Используем канонический origin из NEXT_PUBLIC_APP_URL, чтобы не уезжать
 * на preview-домены. Если переменная не задана — fallback на localhost.
 */
export function getTelegramCtaLinks(): TelegramCtaLinks {
  const canonical = getCanonicalAppUrl();
  const base = canonical ?? LOCAL_FALLBACK_BASE;

  return {
    signupUrl: new URL("/signup", base).toString(),
    profileUrl: new URL("/dashboard/profile", base).toString(),
    hasCanonicalUrl: Boolean(canonical),
  };
}
