/**
 * Регистрирует Telegram webhook.
 *
 * Запуск:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... APP_URL=https://your-app.vercel.app npx tsx scripts/setup-telegram-webhook.ts
 *
 * Для локальной разработки:
 *   1. cloudflared tunnel --url http://localhost:3000
 *   2. TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... APP_URL=https://xxx.trycloudflare.com npx tsx scripts/setup-telegram-webhook.ts
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !appUrl || !webhookSecret) {
  console.error("❌ Требуются переменные окружения: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL");
  console.error("   Пример: TELEGRAM_BOT_TOKEN=123:ABC TELEGRAM_WEBHOOK_SECRET=your_secret APP_URL=https://your.app npx tsx scripts/setup-telegram-webhook.ts");
  process.exit(1);
}

if (webhookSecret.length < 16) {
  console.error("❌ TELEGRAM_WEBHOOK_SECRET отсутствует или слишком короткий (<16 символов).");
  process.exit(1);
}

const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;

async function main() {
  console.log(`\n📡 Регистрирую webhook: ${webhookUrl}\n`);

  // 1. Удалить старый webhook
  const deleteRes = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);
  const deleteData = (await deleteRes.json()) as { ok: boolean };
  console.log(`   Удаление старого webhook: ${deleteData.ok ? "✅" : "❌"}`);

  // 2. Установить новый
  const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    }),
  });
  const setData = (await setRes.json()) as { ok: boolean; description?: string };

  if (setData.ok) {
    console.log(`   Установка нового webhook: ✅`);
  } else {
    console.error(`   Установка нового webhook: ❌ ${setData.description}`);
    process.exit(1);
  }

  // 3. Проверить статус
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = (await infoRes.json()) as { result: Record<string, unknown> };

  console.log("\n📋 Текущий статус webhook (getWebhookInfo):");
  console.log(`   URL:              ${info.result.url}`);
  console.log(`   Pending updates:  ${info.result.pending_update_count}`);
  console.log(`   Last error:       ${info.result.last_error_message ?? "нет"}`);

  // Негативная проверка secret-токена на runtime webhook handler
  const invalidTokenCheckRes = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": "invalid-secret-token",
    },
    body: JSON.stringify({ update_id: -1 }),
  });
  if (invalidTokenCheckRes.status === 403) {
    console.log("   Проверка runtime secret (invalid token): ✅ 403");
  } else {
    console.error(`   Проверка runtime secret (invalid token): ❌ ${invalidTokenCheckRes.status} (ожидался 403)`);
    process.exit(1);
  }

  // Проверить getMe
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = (await meRes.json()) as { result: { username?: string; first_name?: string } };
  console.log(`\n🤖 Бот: @${me.result.username} (${me.result.first_name})`);
  console.log("\n✅ Готово! Отправьте /start боту в Telegram для проверки.\n");
}

main().catch((err) => {
  console.error("Ошибка:", err);
  process.exit(1);
});
