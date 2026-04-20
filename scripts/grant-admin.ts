/**
 * Выдаёт роль admin пользователю по email.
 *
 * Запуск:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... USER_EMAIL=you@hse.ru npx tsx scripts/grant-admin.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.USER_EMAIL;

if (!url || !key || !email) {
  console.error("❌ Требуются: SUPABASE_URL (или NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, USER_EMAIL");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  console.log(`Ищу пользователя ${email}...`);

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error("Ошибка listUsers:", listError.message);
    process.exit(1);
  }

  const user = users.find((u) => u.email === email);
  if (!user) {
    console.error(`❌ Пользователь ${email} не найден в auth.users`);
    process.exit(1);
  }

  console.log(`Найден: ${user.id}`);

  const { error } = await supabase
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", user.id);

  if (error) {
    console.error("❌ Ошибка обновления:", error.message);
    process.exit(1);
  }

  console.log(`✅ Роль admin выдана пользователю ${email} (${user.id})`);
}

main().catch(console.error);
