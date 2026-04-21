import { describe, it, expect } from "vitest";
import { getCurrentDateContext, renderCurrentDateBlock } from "@/lib/ai/current-time";

describe("getCurrentDateContext", () => {
  it("converts UTC instant to MSK calendar fields", () => {
    // 2026-04-21 09:00 UTC = 12:00 MSK, вторник
    const ctx = getCurrentDateContext(new Date("2026-04-21T09:00:00Z"));
    expect(ctx.isoDate).toBe("2026-04-21");
    expect(ctx.timeMsk).toBe("12:00");
    expect(ctx.weekday).toBe("вторник");
    expect(ctx.humanDate).toBe("21 апреля 2026");
  });

  it("handles late-evening UTC that rolls to next MSK day", () => {
    // 2026-04-21 22:00 UTC = 2026-04-22 01:00 MSK, среда
    const ctx = getCurrentDateContext(new Date("2026-04-21T22:00:00Z"));
    expect(ctx.isoDate).toBe("2026-04-22");
    expect(ctx.weekday).toBe("среда");
  });

  it("produces consistent ISO datetime with +03:00 offset", () => {
    const ctx = getCurrentDateContext(new Date("2026-04-21T09:00:00Z"));
    expect(ctx.isoDateTime).toBe("2026-04-21T12:00:00+03:00");
  });
});

describe("renderCurrentDateBlock", () => {
  it("includes date, weekday, time and instructions for relative dates", () => {
    const ctx = getCurrentDateContext(new Date("2026-04-21T09:00:00Z"));
    const block = renderCurrentDateBlock(ctx);
    expect(block).toContain("ТЕКУЩИЕ ДАТА И ВРЕМЯ");
    expect(block).toContain("вторник, 21 апреля 2026");
    expect(block).toContain("2026-04-21");
    expect(block).toContain("12:00");
    expect(block).toContain("через неделю");
    expect(block).toContain("29.04");
    expect(block).toContain("YYYY-MM-DD");
  });
});
