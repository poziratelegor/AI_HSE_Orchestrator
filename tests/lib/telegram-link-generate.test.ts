import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSupabaseServerClient = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mockGetSupabaseServerClient,
}));

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

describe("generateLinkCode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      response: { status: 200 },
    });
  });

  it("throws bot_username_missing when TELEGRAM_BOT_USERNAME is empty", async () => {
    const originalBotUsername = process.env.TELEGRAM_BOT_USERNAME;
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      process.env.TELEGRAM_BOT_USERNAME = "   ";

      const eqMock = vi.fn().mockResolvedValue({ error: null });
      const updateMock = vi.fn(() => ({ eq: eqMock }));
      const fromMock = vi.fn(() => ({ update: updateMock }));

      mockGetSupabaseServerClient.mockReturnValue({
        from: fromMock,
      });

      const { generateLinkCode, BotUsernameMissingError } = await import("@/lib/telegram/link");

      await expect(generateLinkCode("user-42")).rejects.toBeInstanceOf(BotUsernameMissingError);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[telegram/link] missing or invalid TELEGRAM_BOT_USERNAME",
        expect.objectContaining({
          userId: "user-42",
          error: "bot_username_missing",
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
      process.env.TELEGRAM_BOT_USERNAME = originalBotUsername;
    }
  });
});
