import { afterEach, describe, expect, it, vi } from "vitest";
import { answerCallbackQuery, sendMessage } from "@/lib/telegram/bot";

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

  it("passes callback buttons in reply_markup", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendMessage({
      chatId: 123,
      text: "actions",
      replyMarkup: {
        inline_keyboard: [[{ text: "help", callback_data: "help" }]],
      },
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload.reply_markup).toEqual({
      inline_keyboard: [[{ text: "help", callback_data: "help" }]],
    });
  });
});

describe("answerCallbackQuery", () => {
  const tokenBackup = process.env.TELEGRAM_BOT_TOKEN;

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = tokenBackup;
    vi.restoreAllMocks();
  });

  it("sends callback_query_id and optional text", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    });
    vi.stubGlobal("fetch", fetchMock);

    await answerCallbackQuery("cbq-1", { text: "ok" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({ callback_query_id: "cbq-1", text: "ok" });
  });
});
