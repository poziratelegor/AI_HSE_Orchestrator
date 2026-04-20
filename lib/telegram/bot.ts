/**
 * Telegram Bot API helpers.
 *
 * Все функции используют TELEGRAM_BOT_TOKEN из env.
 * Timeout: 15 секунд на любой запрос к Telegram API.
 */

const TELEGRAM_API_TIMEOUT_MS = 15_000;

export function buildTelegramApiUrl(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is missing");
  }

  return `https://api.telegram.org/bot${token}/${method}`;
}

// ─── sendMessage ─────────────────────────────────────────────────────────────

type SendMessageOptions = {
  chatId: number | string;
  text: string;
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  replyToMessageId?: number;
};

export async function sendMessage(opts: SendMessageOptions): Promise<void> {
  const url = buildTelegramApiUrl("sendMessage");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text: opts.text,
        parse_mode: opts.parseMode ?? "Markdown",
        ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "no body");
      console.error(`[telegram/sendMessage] HTTP ${response.status}: ${body}`);
    }
  } catch (err) {
    console.error("[telegram/sendMessage] Error:", err instanceof Error ? err.message : err);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── sendChatAction ──────────────────────────────────────────────────────────

export async function sendChatAction(
  chatId: number | string,
  action: "typing" | "upload_voice" | "upload_document" = "typing"
): Promise<void> {
  const url = buildTelegramApiUrl("sendChatAction");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch {
    // best-effort, не критично
  }
}

// ─── getFile / downloadFile ──────────────────────────────────────────────────

type TelegramFileResult = {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
};

/**
 * Получить file_path от Telegram API для скачивания файла.
 */
export async function getTelegramFilePath(fileId: string): Promise<string | null> {
  const url = buildTelegramApiUrl("getFile");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
      signal: controller.signal
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      ok: boolean;
      result?: TelegramFileResult;
    };

    return data.result?.file_path ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Скачать файл по file_path.
 * Возвращает Blob или null при ошибке.
 */
export async function downloadTelegramFile(filePath: string): Promise<Blob | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;

  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
