import { describe, it, expect } from "vitest";
import {
  PERSONA,
  JSON_OUTPUT_RULES,
  ANTI_HALLUCINATION,
  CITATION_RULES,
  CLASSIFY_FEW_SHOT,
  EXPAND_QUERY_PROMPT,
  buildClassifyPrompt,
  buildRagQaPrompt,
  buildLetterPrompt,
  buildTaskExtractorPrompt,
  buildExplainPrompt,
  buildCheatSheetPrompt,
  buildQuizPrompt,
  buildStudyPlanPrompt,
  buildLectureInsightPrompt,
  buildLectureNotesPrompt
} from "@/lib/ai/prompts";

describe("building blocks", () => {
  it("PERSONA mentions StudyFlow AI identity", () => {
    expect(PERSONA).toContain("StudyFlow AI");
    expect(PERSONA).toContain("ВШЭ");
  });

  it("JSON_OUTPUT_RULES forbids markdown fences", () => {
    expect(JSON_OUTPUT_RULES.toLowerCase()).toContain("markdown");
  });

  it("ANTI_HALLUCINATION forbids inventing facts", () => {
    expect(ANTI_HALLUCINATION).toContain("выдумывай");
  });

  it("CITATION_RULES uses bracketed numeric citations", () => {
    expect(CITATION_RULES).toMatch(/\[\d/);
  });

  it("CLASSIFY_FEW_SHOT contains at least 5 examples", () => {
    const exampleCount = (CLASSIFY_FEW_SHOT.match(/Запрос:/g) || []).length;
    expect(exampleCount).toBeGreaterThanOrEqual(5);
  });

  it("EXPAND_QUERY_PROMPT instructs JSON array output", () => {
    expect(EXPAND_QUERY_PROMPT).toContain("JSON");
    expect(EXPAND_QUERY_PROMPT).toContain("массив");
  });
});

describe("buildClassifyPrompt", () => {
  it("interpolates workflow descriptions", () => {
    const prompt = buildClassifyPrompt("- foo: test workflow\n- bar: another");
    expect(prompt).toContain("foo: test workflow");
    expect(prompt).toContain("bar: another");
  });

  it("includes few-shot examples", () => {
    const prompt = buildClassifyPrompt("");
    expect(prompt).toContain("ПРИМЕРЫ КЛАССИФИКАЦИИ");
  });

  it("includes JSON output rules", () => {
    const prompt = buildClassifyPrompt("");
    expect(prompt).toContain("ФОРМАТ ОТВЕТА");
  });
});

describe("buildRagQaPrompt", () => {
  it("works without student context", () => {
    const prompt = buildRagQaPrompt(null);
    expect(prompt).toContain("StudyFlow AI");
    expect(prompt).toContain("ЦИТИРОВАНИЕ");
  });

  it("injects student name when provided", () => {
    const prompt = buildRagQaPrompt({ userId: "u1", fullName: "Иван Петров", faculty: "ФКН" });
    expect(prompt).toContain("Иван Петров");
    expect(prompt).toContain("ФКН");
  });
});

describe("buildLetterPrompt", () => {
  it("includes student signature when context provided", () => {
    const prompt = buildLetterPrompt({
      userId: "u1",
      fullName: "Анна Смирнова",
      faculty: "ФКН",
      courseNumber: 2,
      groupName: "БПИ-221"
    });
    expect(prompt).toContain("Анна Смирнова");
    expect(prompt).toContain("ФКН");
    expect(prompt).toContain("2 курс");
    expect(prompt).toContain("БПИ-221");
  });

  it("falls back gracefully when no student context", () => {
    const prompt = buildLetterPrompt(null);
    expect(prompt).toContain("Студент");
  });
});

describe("buildTaskExtractorPrompt", () => {
  it("includes today's date", () => {
    const prompt = buildTaskExtractorPrompt("2026-04-19");
    expect(prompt).toContain("2026-04-19");
  });

  it("describes priority levels", () => {
    const prompt = buildTaskExtractorPrompt("2026-04-19");
    expect(prompt).toContain("urgent");
    expect(prompt).toContain("high");
    expect(prompt).toContain("medium");
    expect(prompt).toContain("low");
  });
});

describe("buildExplainPrompt", () => {
  it("adapts to course number", () => {
    const prompt = buildExplainPrompt({ userId: "u1", courseNumber: 1, faculty: "ФКН" });
    expect(prompt).toContain("1 курса");
  });

  it("works without context", () => {
    const prompt = buildExplainPrompt(null);
    expect(prompt).toContain("аналогия");
  });
});

describe("buildCheatSheetPrompt", () => {
  it("describes definitions, formulas, examples, tips", () => {
    const prompt = buildCheatSheetPrompt(null);
    expect(prompt).toContain("definitions");
    expect(prompt).toContain("formulas");
    expect(prompt).toContain("examples");
    expect(prompt).toContain("tips");
  });
});

describe("buildQuizPrompt", () => {
  it("includes the requested question count", () => {
    const prompt = buildQuizPrompt(7);
    expect(prompt).toContain("7");
  });

  it("describes difficulty distribution", () => {
    const prompt = buildQuizPrompt(10);
    expect(prompt).toContain("лёгких");
    expect(prompt).toContain("средних");
    expect(prompt).toContain("сложных");
  });
});

describe("buildStudyPlanPrompt", () => {
  it("includes today and course context", () => {
    const prompt = buildStudyPlanPrompt("2026-04-19", { userId: "u1", courseNumber: 3 });
    expect(prompt).toContain("2026-04-19");
    expect(prompt).toContain("3 курса");
  });

  it("limits daily duration", () => {
    const prompt = buildStudyPlanPrompt("2026-04-19", null);
    expect(prompt).toContain("4 час");
  });
});

describe("buildLectureInsightPrompt and buildLectureNotesPrompt", () => {
  it("lecture insight has topics + terms + key_ideas + summary schema", () => {
    const prompt = buildLectureInsightPrompt();
    expect(prompt).toContain("topics");
    expect(prompt).toContain("terms");
    expect(prompt).toContain("key_ideas");
    expect(prompt).toContain("summary");
  });

  it("lecture notes has keyPoints + actionItems schema", () => {
    const prompt = buildLectureNotesPrompt();
    expect(prompt).toContain("keyPoints");
    expect(prompt).toContain("actionItems");
  });
});
