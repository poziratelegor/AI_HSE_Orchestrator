import { describe, expect, it } from "vitest";
import { normalizeOrchestrateResult } from "@/lib/orchestrator/normalize-result";

describe("normalizeOrchestrateResult", () => {
  it("normalizes letter_generator", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: {
        workflow: "letter_generator",
        data: { subject: "Тема письма", body: "Текст письма" },
      },
    });

    expect(r.status).toBe("ok");
    expect(r.workflow).toBe("letter_generator");
    expect(r.title).toBe("Письмо");
    expect(r.text).toBe("Текст письма");
    expect(r.subtitle).toBe("Тема письма");
  });

  it("normalizes task_extractor", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: {
        workflow: "task_extractor",
        data: { tasks: [{ title: "Сдать ДЗ", priority: "high", due_date: "2026-04-25" }] },
      },
    });

    expect(r.title).toBe("Задачи");
    expect(r.text).toContain("Сдать ДЗ");
    expect(r.text).toContain("приоритет: high");
  });

  it("normalizes study_plan", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: {
        workflow: "study_plan",
        summary: "План на неделю",
        data: {
          daily_plan: [{ day: 1, theme: "Линал", tasks: ["Повторить матрицы"] }],
        },
      },
    });

    expect(r.title).toBe("Учебный план");
    expect(r.text).toContain("День 1");
    expect(r.text).toContain("Повторить матрицы");
    expect(r.subtitle).toBe("План на неделю");
  });

  it("normalizes explain_this", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: { workflow: "explain_this", data: { explanation: "Объяснение темы" } },
    });
    expect(r.title).toBe("Объяснение");
    expect(r.text).toBe("Объяснение темы");
  });

  it("normalizes cheat_sheet", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: { workflow: "cheat_sheet", data: { points: ["Формула 1", "Формула 2"] } },
    });
    expect(r.title).toBe("Шпаргалка");
    expect(r.text).toContain("1. Формула 1");
  });

  it("normalizes quiz_generator", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: {
        workflow: "quiz_generator",
        data: {
          questions: [{ question: "2+2?", options: ["3", "4"], correct: "4" }],
        },
      },
    });
    expect(r.title).toBe("Тест");
    expect(r.text).toContain("2+2?");
    expect(r.text).toContain("Ответ: 4");
  });

  it("normalizes lecture_insight", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: {
        workflow: "lecture_insight",
        data: { key_ideas: ["Идея 1", "Идея 2"], summary: "Кратко" },
      },
    });
    expect(r.title).toBe("Конспект лекции");
    expect(r.text).toContain("Главные идеи");
    expect(r.text).toContain("Идея 1");
  });

  it("normalizes rag_qa", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: { workflow: "rag_qa", data: { answer: "Ответ из документов" } },
    });
    expect(r.title).toBe("Ответ по документам");
    expect(r.text).toBe("Ответ из документов");
  });

  it("normalizes route_recommender as clarification", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: {
        workflow: "route_recommender",
        data: { question: "Уточните формат ответа" },
      },
    });
    expect(r.status).toBe("clarification");
    expect(r.text).toContain("Уточните формат");
  });

  it("normalizes error", () => {
    const r = normalizeOrchestrateResult({ ok: false, message: "Ошибка выполнения" });
    expect(r.status).toBe("error");
    expect(r.title).toBe("Ошибка");
    expect(r.text).toBe("Ошибка выполнения");
  });

  it("marks json fallback as debug-case", () => {
    const r = normalizeOrchestrateResult({
      ok: true,
      result: { workflow: "letter_generator", data: { unknown: { a: 1 } } },
    });
    expect(r.isDebugFallback).toBe(true);
    expect(r.subtitle).toBe("debug-case");
  });
});
