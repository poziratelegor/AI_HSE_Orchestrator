import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock OpenAI — prevent real API calls
vi.mock("@/lib/ai/client", () => ({
  getOpenAIClient: () => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: '{"intent":"rag_qa","confidence":0.9,"reason":"test","needs_clarification":false,"clarification_question":null}' } }]
        })
      }
    }
  }),
  DEFAULT_MODEL: "gpt-4o-mini"
}));

vi.mock("@/lib/ai/retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn()
}));

// Now import after mocks
import { classifyIntent, isKnownWorkflow } from "@/lib/orchestrator/classify";

describe("classifyIntent — keyword matching", () => {
  beforeEach(() => {
    // Disable LLM for keyword-only tests
    delete process.env.OPENAI_API_KEY;
  });

  it("classifies letter request by keyword", async () => {
    const result = await classifyIntent("Напиши письмо в деканат");
    expect(result.intent).toBe("letter_generator");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("classifies task extraction by keyword", async () => {
    const result = await classifyIntent("Какие у меня дедлайны на этой неделе?");
    expect(result.intent).toBe("task_extractor");
  });

  it("classifies RAG query by keyword", async () => {
    const result = await classifyIntent("Найди в материалах информацию о нейросетях");
    expect(result.intent).toBe("rag_qa");
  });

  it("classifies cheat sheet by keyword", async () => {
    const result = await classifyIntent("Сделай шпаргалку по линейной алгебре");
    expect(result.intent).toBe("cheat_sheet");
  });

  it("classifies explain by keyword", async () => {
    const result = await classifyIntent("Объясни мне теорему Байеса");
    expect(result.intent).toBe("explain_this");
  });

  it("classifies study plan by keyword", async () => {
    const result = await classifyIntent("Составь план подготовки к экзамену");
    expect(result.intent).toBe("study_plan");
  });

  it("classifies quiz by keyword", async () => {
    const result = await classifyIntent("Сгенерируй тест по истории России");
    expect(result.intent).toBe("quiz_generator");
  });

  it("falls back to route_recommender for ambiguous input", async () => {
    const result = await classifyIntent("Привет, как дела?");
    expect(result.intent).toBe("route_recommender");
    expect(result.confidence).toBeLessThan(0.45);
  });

  it("falls back with clarification for unknown requests", async () => {
    const result = await classifyIntent("xyz abc 12345");
    expect(result.intent).toBe("route_recommender");
  });
});

describe("isKnownWorkflow", () => {
  it("returns true for known workflows", () => {
    expect(isKnownWorkflow("rag_qa")).toBe(true);
    expect(isKnownWorkflow("letter_generator")).toBe(true);
    expect(isKnownWorkflow("task_extractor")).toBe(true);
  });

  it("returns false for unknown workflows", () => {
    expect(isKnownWorkflow("unknown_workflow")).toBe(false);
    expect(isKnownWorkflow("")).toBe(false);
  });
});
