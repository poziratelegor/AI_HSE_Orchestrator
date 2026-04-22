import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
  });

  it("allows the first request when key is missing, even with failOpen=false", async () => {
    mockCacheGet.mockResolvedValue(null);
    mockCacheSet.mockResolvedValue(undefined);

    const { checkRateLimit } = await import("@/lib/api/rate-limit");

    const result = await checkRateLimit("user-1", {
      limit: 3,
      windowSeconds: 60,
      action: "telegram_chat",
      failOpen: false,
    });

    expect(result.allowed).toBe(true);
    expect(mockCacheSet).toHaveBeenCalledTimes(1);
  });
});
