import { describe, it, expect } from "vitest";
import { renderStudentContextBlock } from "@/lib/ai/student-context";

describe("renderStudentContextBlock", () => {
  it("returns empty string for null context", () => {
    expect(renderStudentContextBlock(null)).toBe("");
  });

  it("returns empty string for undefined context", () => {
    expect(renderStudentContextBlock(undefined)).toBe("");
  });

  it("returns empty string when no fields are set besides userId", () => {
    expect(renderStudentContextBlock({ userId: "u1" })).toBe("");
  });

  it("renders only the fields that are present", () => {
    const result = renderStudentContextBlock({
      userId: "u1",
      fullName: "Иван Петров",
      university: "НИУ ВШЭ"
    });
    expect(result).toContain("Имя: Иван Петров");
    expect(result).toContain("ВУЗ: НИУ ВШЭ");
    expect(result).not.toContain("Факультет");
    expect(result).not.toContain("Группа");
  });

  it("renders all fields when provided", () => {
    const result = renderStudentContextBlock({
      userId: "u1",
      fullName: "Иван Петров",
      university: "НИУ ВШЭ",
      faculty: "ФКН",
      groupName: "БПИ-211",
      courseNumber: 3
    });
    expect(result).toContain("ИНФОРМАЦИЯ О СТУДЕНТЕ");
    expect(result).toContain("Имя: Иван Петров");
    expect(result).toContain("ВУЗ: НИУ ВШЭ");
    expect(result).toContain("Факультет: ФКН");
    expect(result).toContain("Группа: БПИ-211");
    expect(result).toContain("Курс: 3");
  });

  it("does not render fields with falsy values", () => {
    const result = renderStudentContextBlock({
      userId: "u1",
      fullName: undefined,
      faculty: ""
    });
    expect(result).toBe("");
  });
});
