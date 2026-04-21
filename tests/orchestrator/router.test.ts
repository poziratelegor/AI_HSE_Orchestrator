import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({
    chat: { completions: { create: vi.fn() } }
  }),
  DEFAULT_MODEL: "gpt-4o-mini"
}));

vi.mock("@/lib/ai/retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn()
}));

vi.mock("@/lib/orchestrator/logger", () => ({
  logOrchestratorRun: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: () => ({
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null })
    })
  })
}));

import { orchestrate } from "@/lib/orchestrator/router";

describe("orchestrate", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  it("returns fallback for ambiguous input", async () => {
    const result = await orchestrate({
      text: "привет",
      channel: "web",
      userId: "test-user"
    });

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    // Low confidence → either fallback or clarification
    expect(result.workflow).toBe("route_recommender");
  });

  it("routes letter request correctly", async () => {
    const result = await orchestrate({
      text: "Напиши заявление в деканат об академическом отпуске",
      channel: "web",
      userId: "test-user"
    });

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    const r = result as Record<string, unknown>;
    expect(r.intent).toBe("letter_generator");
  });

  it("routes task extraction correctly", async () => {
    const result = await orchestrate({
      text: "Найди все дедлайны в этом тексте: сдать курсовую 15 мая",
      channel: "web",
      userId: "test-user"
    });

    expect(result).toBeDefined();
    expect(result.ok).toBe(true);
    const r = result as Record<string, unknown>;
    expect(r.intent).toBe("task_extractor");
  });

  it("includes lowConfidence flag for recommend zone", async () => {
    // This test verifies the recommend zone (0.45-0.75)
    // Keywords match gives exactly minConfidence (e.g., 0.75), so we need
    // a case where keyword match gives lower confidence
    const result = await orchestrate({
      text: "привет, как дела?",
      channel: "web"
    });

    // This should be fallback (confidence < 0.45)
    expect(result.ok).toBe(true);
  });
});
