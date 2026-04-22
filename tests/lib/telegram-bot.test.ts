import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMessage } from "@/lib/telegram/bot";

describe("sendMessage", () => {
  const tokenBackup = process.env.TELEGRAM_BOT_TOKEN;

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = tokenBackup;
    vi.restoreAllMocks();
  });

  it("passes reply_markup to Telegram API when provided", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendMessage({
      chatId: 123,
      text: "hello",
      replyMarkup: {
        inline_keyboard: [[{ text: "Зарегистрироваться", url: "https://app.example/signup" }]],
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.reply_markup).toEqual({
      inline_keyboard: [[{ text: "Зарегистрироваться", url: "https://app.example/signup" }]],
    });
  });
});
