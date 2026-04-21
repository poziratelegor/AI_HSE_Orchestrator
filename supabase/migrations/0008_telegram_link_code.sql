-- 0008_telegram_link_code.sql
-- Adds short-lived OTP-style code for linking Telegram account to Supabase user.
-- Flow:
--   1. User opens /dashboard/profile → clicks "Привязать Telegram" → server
--      generates 8-char code, stores in profiles.telegram_link_code with 15-min TTL.
--   2. User sends `/start link_<code>` (deep-link) to bot → handler looks up
--      profile by code (and not expired), sets telegram_users.user_id, clears code.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_link_code        text,
  ADD COLUMN IF NOT EXISTS telegram_link_expires_at  timestamptz;

-- Partial index — only active codes, fast lookup from bot webhook
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_link_code
  ON public.profiles (telegram_link_code)
  WHERE telegram_link_code IS NOT NULL;
