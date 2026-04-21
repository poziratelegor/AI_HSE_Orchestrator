import { describe, it, expect } from "vitest";
import { parseCitations } from "@/lib/parseCitations";

describe("parseCitations", () => {
  it("returns single text segment when no citations present", () => {
    const result = parseCitations("Просто текст без ссылок");
    expect(result).toEqual([
      { type: "text", value: "Просто текст без ссылок" }
    ]);
  });

  it("parses simple [N] citation", () => {
    const result = parseCitations("См. [1] для деталей");
    expect(result).toEqual([
      { type: "text", value: "См. " },
      { type: "citation", value: 1 },
      { type: "text", value: " для деталей" }
    ]);
  });

  it("parses multi-digit citations like [10]", () => {
    const result = parseCitations("Ссылка [10] и [42]");
    expect(result).toEqual([
      { type: "text", value: "Ссылка " },
      { type: "citation", value: 10 },
      { type: "text", value: " и " },
      { type: "citation", value: 42 }
    ]);
  });

  it("parses adjacent citations [1][2]", () => {
    const result = parseCitations("Источники [1][2]");
    expect(result).toEqual([
      { type: "text", value: "Источники " },
      { type: "citation", value: 1 },
      { type: "citation", value: 2 }
    ]);
  });

  it("returns empty array for empty input", () => {
    const result = parseCitations("");
    expect(result).toEqual([]);
  });

  it("ignores non-numeric brackets like [foo]", () => {
    const result = parseCitations("Текст [foo] и [1]");
    expect(result).toEqual([
      { type: "text", value: "Текст [foo] и " },
      { type: "citation", value: 1 }
    ]);
  });
});
