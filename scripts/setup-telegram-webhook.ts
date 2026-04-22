/**
 * Регистрирует Telegram webhook.
 *
 * Запуск:
 *   TELEGRAM_BOT_TOKEN=... APP_URL=https://your-app.vercel.app npx tsx scripts/setup-telegram-webhook.ts
 *
 * Для локальной разработки:
 *   1. cloudflared tunnel --url http://localhost:3000
 *   2. TELEGRAM_BOT_TOKEN=... APP_URL=https://xxx.trycloudflare.com npx tsx scripts/setup-telegram-webhook.ts
 */

const token = process.env.TELEGRAM_BOT_TOKEN;
const appUrl = process.env.APP_URL;

if (!token || !appUrl) {
  console.error("❌ Требуются переменные окружения: TELEGRAM_BOT_TOKEN, APP_URL");
  console.error("   Пример: TELEGRAM_BOT_TOKEN=123:ABC APP_URL=https://your.app npx tsx scripts/setup-telegram-webhook.ts");
  process.exit(1);
}

const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/telegram/webhook`;
const normalizedAppUrl = appUrl.replace(/\/$/, "");

const telegramCommands = [
  { command: "start", description: "Старт и быстрые кнопки" },
  { command: "help", description: "Помощь и UX-сценарии" },
  { command: "link", description: "Привязка/перепривязка аккаунта" },
] as const;

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
      allowed_updates: ["message", "callback_query"],
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

  // 3. Установить команды бота (default + ru локаль)
  const setCommandsDefaultRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: telegramCommands,
    }),
  });
  const setCommandsDefaultData = (await setCommandsDefaultRes.json()) as {
    ok: boolean;
    description?: string;
  };
  console.log(
    `   Установка команд (default): ${setCommandsDefaultData.ok ? "✅" : `❌ ${setCommandsDefaultData.description ?? "unknown error"}`}`,
  );

  const setCommandsRuRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: telegramCommands,
      language_code: "ru",
    }),
  });
  const setCommandsRuData = (await setCommandsRuRes.json()) as {
    ok: boolean;
    description?: string;
  };
  console.log(`   Установка команд (ru): ${setCommandsRuData.ok ? "✅" : `❌ ${setCommandsRuData.description ?? "unknown error"}`}`);

  // 4. Установить кнопку меню (опционально)
  const setMenuButtonRes = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      menu_button: {
        type: "web_app",
        text: "Открыть приложение",
        web_app: { url: normalizedAppUrl },
      },
    }),
  });
  const setMenuButtonData = (await setMenuButtonRes.json()) as {
    ok: boolean;
    description?: string;
  };
  console.log(
    `   Установка кнопки меню: ${setMenuButtonData.ok ? "✅" : `⚠️ ${setMenuButtonData.description ?? "unknown error"} (пропускаю, опционально)`}`,
  );

  // 5. Проверить статус
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const info = (await infoRes.json()) as { result: Record<string, unknown> };

  console.log("\n📋 Текущий статус webhook:");
  console.log(`   URL:              ${info.result.url}`);
  console.log(`   Pending updates:  ${info.result.pending_update_count}`);
  console.log(`   Last error:       ${info.result.last_error_message ?? "нет"}`);

  // 6. Проверить getMe
  const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const me = (await meRes.json()) as { result: { username?: string; first_name?: string } };
  console.log(`\n🤖 Бот: @${me.result.username} (${me.result.first_name})`);
  console.log("\n✅ Готово! Отправьте /start боту в Telegram для проверки.\n");
}

main().catch((err) => {
  console.error("Ошибка:", err);
  process.exit(1);
});
