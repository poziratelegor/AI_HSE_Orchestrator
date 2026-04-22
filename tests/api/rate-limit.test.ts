import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCacheGetWithAvailability = vi.fn();
const mockCacheSet = vi.fn();

vi.mock("@/lib/cache/redis", () => ({
  cacheGetWithAvailability: mockCacheGetWithAvailability,
  cacheSet: mockCacheSet,
}));

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
  });

  it("allows the first request when key is missing, even with failOpen=false", async () => {
    mockCacheGetWithAvailability.mockResolvedValue({ value: null, unavailable: false });
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

  it("returns 503 when Redis is unavailable and failOpen=false", async () => {
    mockCacheGetWithAvailability.mockResolvedValue({ value: null, unavailable: true });

    const { checkRateLimit } = await import("@/lib/api/rate-limit");

    const result = await checkRateLimit("user-1", {
      limit: 3,
      windowSeconds: 60,
      action: "telegram_chat",
      failOpen: false,
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.response.status).toBe(503);
    }
    expect(mockCacheSet).not.toHaveBeenCalled();
  });
});
