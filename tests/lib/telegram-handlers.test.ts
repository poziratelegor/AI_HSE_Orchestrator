import { beforeEach, describe, expect, it, vi } from "vitest";

const mockOrchestrate = vi.fn();
const mockSendMessage = vi.fn();
const mockSendMessageChunks = vi.fn();
const mockSendChatAction = vi.fn();
const mockAnswerCallbackQuery = vi.fn();
const mockGetTelegramFilePath = vi.fn();
const mockDownloadTelegramFile = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockCacheSetIfAbsent = vi.fn();
const mockConsumeLinkCode = vi.fn();
const mockParseStartLinkPayload = vi.fn();
const mockGetTelegramCtaLinks = vi.fn();
const mockFormatOrchestrateResultForTelegram = vi.fn();

const telegramUsersSingle = vi.fn();
const telegramUsersEq = vi.fn();
const telegramUsersSelect = vi.fn();
const telegramUsersUpsert = vi.fn();

vi.mock("@/lib/orchestrator/router", () => ({ orchestrate: mockOrchestrate }));
vi.mock("@/lib/telegram/bot", () => ({
  sendMessage: mockSendMessage,
  sendMessageChunks: mockSendMessageChunks,
  sendChatAction: mockSendChatAction,
  answerCallbackQuery: mockAnswerCallbackQuery,
  getTelegramFilePath: mockGetTelegramFilePath,
  downloadTelegramFile: mockDownloadTelegramFile,
}));
vi.mock("@/lib/api/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/lib/cache/redis", () => ({ cacheSetIfAbsent: mockCacheSetIfAbsent }));
vi.mock("@/lib/telegram/link", () => ({
  consumeLinkCode: mockConsumeLinkCode,
  parseStartLinkPayload: mockParseStartLinkPayload,
}));
vi.mock("@/lib/telegram/app-url", () => ({ getTelegramCtaLinks: mockGetTelegramCtaLinks }));
vi.mock("@/lib/telegram/format", () => ({
  formatOrchestrateResultForTelegram: mockFormatOrchestrateResultForTelegram,
}));
vi.mock("@/lib/services/documents/ingestion", () => ({ processDocument: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ getOpenAIClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    from: (table: string) => {
      if (table === "telegram_users") {
        return {
          upsert: telegramUsersUpsert,
          select: telegramUsersSelect,
        };
      }
      return {
        select: vi.fn(() => ({ eq: vi.fn() })),
      };
    },
    storage: {
      from: vi.fn(() => ({ upload: vi.fn() })),
    },
  }),
}));

function makeMessageUpdate(params: {
  text?: string;
  telegramUserId?: number;
  messageId?: number;
  chatId?: number;
  voice?: Record<string, unknown>;
  document?: Record<string, unknown>;
}) {
  return {
    update_id: 1000,
    message: {
      message_id: params.messageId ?? 101,
      from: {
        id: params.telegramUserId ?? 777,
        is_bot: false,
        first_name: "Test",
      },
      chat: { id: params.chatId ?? 555, type: "private" },
      date: 1,
      ...(params.text !== undefined ? { text: params.text } : {}),
      ...(params.voice ? { voice: params.voice } : {}),
      ...(params.document ? { document: params.document } : {}),
    },
  };
}

describe("telegram handler auth gate and callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheSetIfAbsent.mockResolvedValue(true);
    mockCheckRateLimit.mockResolvedValue({ allowed: true, response: { status: 200 } });
    mockGetTelegramCtaLinks.mockReturnValue({
      signupUrl: "https://example.com/signup",
      profileUrl: "https://example.com/profile",
      hasCanonicalUrl: true,
    });
    mockParseStartLinkPayload.mockReturnValue(null);

    telegramUsersSingle.mockResolvedValue({ data: null });
    telegramUsersEq.mockReturnValue({ single: telegramUsersSingle });
    telegramUsersSelect.mockReturnValue({ eq: telegramUsersEq });

    mockFormatOrchestrateResultForTelegram.mockReturnValue({ chunks: ["ok"] });
    mockOrchestrate.mockResolvedValue({ ok: true });
  });

  it("/start stays available and returns onboarding/help message", async () => {
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(makeMessageUpdate({ text: "/start" }));

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const payload = mockSendMessage.mock.calls[0][0] as { text: string };
    expect(payload.text).toContain("StudyFlow AI");
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it("/start for linked user does not drop authorization", async () => {
    telegramUsersSingle.mockResolvedValue({ data: { user_id: "user-42", fsm_state: "idle", fsm_context: {} } });
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(makeMessageUpdate({ text: "/start" }));

    expect(telegramUsersUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        telegram_user_id: "777",
        fsm_state: "idle",
      }),
      { onConflict: "telegram_user_id" }
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const payload = mockSendMessage.mock.calls[0][0] as { text: string };
    expect(payload.text).toContain("StudyFlow AI");
  });

  it("unlinked telegram user receives registration message for normal text", async () => {
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(makeMessageUpdate({ text: "Привет" }));

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const payload = mockSendMessage.mock.calls[0][0] as { text: string };
    expect(payload.text).toContain("зарегистрированных пользователей");
    expect(mockOrchestrate).not.toHaveBeenCalled();
  });

  it("linked telegram_user_id passes auth gate and reaches orchestration", async () => {
    telegramUsersSingle.mockResolvedValue({ data: { user_id: "user-42" } });
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(makeMessageUpdate({ text: "Составь план" }));

    expect(mockOrchestrate).toHaveBeenCalledWith({
      text: "Составь план",
      channel: "telegram",
      userId: "user-42",
    });
    expect(mockSendMessageChunks).toHaveBeenCalledTimes(1);
  });

  it("/help and callback help continue to work", async () => {
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(makeMessageUpdate({ text: "/help", messageId: 201 }));
    await handleTelegramUpdate({
      update_id: 1002,
      callback_query: {
        id: "cb-1",
        from: { id: 777, is_bot: false, first_name: "Test" },
        data: "help",
        message: {
          message_id: 202,
          from: { id: 777, is_bot: false, first_name: "Test" },
          chat: { id: 555, type: "private" },
          date: 1,
        },
      },
    });

    expect(mockSendMessage).toHaveBeenCalledTimes(2);
    expect(mockAnswerCallbackQuery).toHaveBeenCalledWith("cb-1");
  });

  it("callback auth:start switches FSM to await_profile and prompts user", async () => {
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate({
      update_id: 1003,
      callback_query: {
        id: "cb-2",
        from: { id: 777, is_bot: false, first_name: "Test" },
        data: "auth:start",
        message: {
          message_id: 203,
          from: { id: 777, is_bot: false, first_name: "Test" },
          chat: { id: 555, type: "private" },
          date: 1,
        },
      },
    });

    expect(telegramUsersUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        telegram_user_id: "777",
        fsm_state: "await_profile",
      }),
      { onConflict: "telegram_user_id" }
    );
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    const payload = mockSendMessage.mock.calls[0][0] as { text: string };
    expect(payload.text).toContain("Отправьте *ФИО и группу*");
  });

  it("document and voice branches do not start for unauthorized user", async () => {
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(
      makeMessageUpdate({
        document: { file_id: "doc-1", file_unique_id: "u-doc", file_name: "a.pdf", mime_type: "application/pdf" },
      })
    );

    await handleTelegramUpdate(
      makeMessageUpdate({
        messageId: 103,
        voice: { file_id: "v-1", file_unique_id: "u-v", duration: 1, mime_type: "audio/ogg" },
      })
    );

    expect(mockGetTelegramFilePath).not.toHaveBeenCalled();
    expect(mockDownloadTelegramFile).not.toHaveBeenCalled();
    expect(mockOrchestrate).not.toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledTimes(2);
  });

  it("linked users get negative handling for empty messages", async () => {
    telegramUsersSingle.mockResolvedValue({ data: { user_id: "user-42" } });
    const { handleTelegramUpdate } = await import("@/lib/telegram/handlers");

    await handleTelegramUpdate(makeMessageUpdate({ text: "    " }));

    expect(mockOrchestrate).not.toHaveBeenCalled();
    const payload = mockSendMessage.mock.calls[0][0] as { text: string };
    expect(payload.text).toContain("Напишите задачу текстом");
  });
});
