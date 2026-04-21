import { describe, expect, it } from "vitest";
import {
  formatOrchestrateResultForTelegram,
  splitForTelegram,
} from "@/lib/telegram/format";

describe("splitForTelegram", () => {
  it("returns single chunk if under limit", () => {
    expect(splitForTelegram("hello")).toEqual(["hello"]);
  });

  it("splits long text into chunks under limit", () => {
    const longText = ("a".repeat(500) + "\n\n").repeat(20);
    const chunks = splitForTelegram(longText, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(1000);
    }
  });

  it("prefers double-newline boundaries", () => {
    const text = "para1".padEnd(80, "x") + "\n\n" + "para2".padEnd(80, "x");
    const chunks = splitForTelegram(text, 100);
    expect(chunks[0]).toContain("para1");
    expect(chunks[0]).not.toContain("para2");
  });

  it("handles empty string", () => {
    expect(splitForTelegram("")).toEqual([""]);
  });
});

describe("formatOrchestrateResultForTelegram", () => {
  it("formats letter (subject + body)", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "letter_generator",
        data: { subject: "Запрос консультации", body: "Уважаемый профессор..." },
      },
    });
    expect(r.workflow).toBe("letter_generator");
    expect(r.chunks[0]).toContain("Письмо");
    expect(r.chunks[0]).toContain("Запрос консультации");
    expect(r.chunks[0]).toContain("Уважаемый профессор");
  });

  it("formats tasks array with priority emoji", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "task_extractor",
        data: {
          tasks: [
            { title: "Сдать ДЗ", priority: "urgent", due_date: "2026-04-25T18:00:00Z" },
            { title: "Прочесть главу", priority: "low" },
          ],
        },
      },
    });
    expect(r.chunks[0]).toContain("Задачи");
    expect(r.chunks[0]).toContain("Сдать ДЗ");
    expect(r.chunks[0]).toContain("приоритет: urgent");
    expect(r.chunks[0]).toContain("Прочесть главу");
    expect(r.chunks[0]).toContain("Прочесть главу");
  });

  it("formats task_extractor without crashing when saved exists", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "task_extractor",
        data: { tasks: [{ title: "X" }], saved: 3 },
      },
    });
    expect(r.chunks[0]).toContain("1. X");
  });

  it("formats explanation", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "explain_this",
        data: { explanation: "Это объяснение темы." },
      },
    });
    expect(r.chunks[0]).toContain("Объяснение");
    expect(r.chunks[0]).toContain("Это объяснение темы");
  });

  it("formats RAG answer", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "rag_qa",
        data: { answer: "Ответ из документов." },
      },
    });
    expect(r.chunks[0]).toContain("Ответ из документов");
  });

  it("formats clarification question", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "route_recommender",
        data: { question: "Уточните что именно нужно?" },
      },
    });
    expect(r.chunks[0]).toContain("❓");
    expect(r.chunks[0]).toContain("Уточните");
  });

  it("formats error response", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: false,
      message: "Что-то пошло не так",
    });
    expect(r.chunks[0]).toContain("⚠️");
    expect(r.chunks[0]).toContain("Что-то пошло не так");
  });

  it("handles plain string result", () => {
    const r = formatOrchestrateResultForTelegram("just a string");
    expect(r.chunks[0]).toContain("just a string");
  });

  it("handles null/undefined result", () => {
    expect(formatOrchestrateResultForTelegram(null).chunks[0]).toContain("ошибка");
    expect(formatOrchestrateResultForTelegram(undefined).chunks[0]).toContain("ошибка");
  });

  it("formats study plan with daily_plan", () => {
    const r = formatOrchestrateResultForTelegram({
      ok: true,
      result: {
        workflow: "study_plan",
        data: {
          daily_plan: [
            { day: 1, theme: "Введение", tasks: ["Прочитать гл.1"], duration_hours: 2 },
            { day: 2, theme: "Практика", tasks: ["Решить задачи"] },
          ],
        },
      },
    });
    expect(r.chunks[0]).toContain("Учебный план");
    expect(r.chunks[0]).toContain("День 1");
    expect(r.chunks[0]).toContain("Введение");
    expect(r.chunks[0]).toContain("Прочитать гл.1");
  });
});
