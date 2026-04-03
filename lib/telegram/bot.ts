export function buildTelegramApiUrl(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  return `https://api.telegram.org/bot${token}/${method}`;
}
