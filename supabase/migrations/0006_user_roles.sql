-- Добавить роль к профилям пользователей
-- Значения: 'user' (по умолчанию), 'admin' (команда проекта)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

COMMENT ON COLUMN profiles.role IS 'Роль пользователя: user (обычный) или admin (команда проекта, доступ к аналитике)';

-- Выдать admin вручную:
-- UPDATE profiles SET role = 'admin' WHERE id = 'YOUR_USER_UUID';
