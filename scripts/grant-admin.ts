/**
 * Выдаёт роль admin одному или нескольким пользователям по email.
 *
 * Запуск (один email):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_EMAIL=you@hse.ru npx tsx scripts/grant-admin.ts
 *
 * Запуск (несколько — через запятую или пробел):
 *   USER_EMAIL="a@hse.ru,b@hse.ru c@hse.ru" npx tsx scripts/grant-admin.ts
 *
 * Можно передать также аргументами командной строки:
 *   npx tsx scripts/grant-admin.ts a@hse.ru b@hse.ru
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const fromEnv = (process.env.USER_EMAIL ?? "")
  .split(/[,\s]+/)
  .map((s) => s.trim())
  .filter(Boolean);
const fromArgs = process.argv.slice(2).map((s) => s.trim()).filter(Boolean);
const emails = Array.from(new Set([...fromEnv, ...fromArgs]));

if (!url || !key || emails.length === 0) {
  console.error(
    "❌ Требуются: SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL (или email-аргументы)"
  );
  process.exit(1);
}

const supabase = createClient(url, key);

async function fetchAllUsers() {
  const all: Array<{ id: string; email: string | undefined }> = [];
  let page = 1;
  const perPage = 1000;
  // Пагинация: берём страницы пока не закончатся
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    all.push(...data.users.map((u) => ({ id: u.id, email: u.email })));
    if (data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

async function main() {
  console.log(`Получаю список пользователей...`);
  const users = await fetchAllUsers();
  console.log(`Всего в auth.users: ${users.length}`);

  let okCount = 0;
  let failCount = 0;

  for (const email of emails) {
    const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      console.error(`❌ ${email} — не найден в auth.users`);
      failCount += 1;
      continue;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", user.id);

    if (error) {
      console.error(`❌ ${email} (${user.id}) — ошибка обновления: ${error.message}`);
      failCount += 1;
      continue;
    }

    console.log(`✅ ${email} (${user.id}) — роль admin выдана`);
    okCount += 1;
  }

  console.log(`\nГотово. Успешно: ${okCount}, ошибок: ${failCount}.`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
