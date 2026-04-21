import { describe, expect, it } from "vitest";
import { parseStartLinkPayload } from "@/lib/telegram/link";

describe("parseStartLinkPayload", () => {
  it("parses /start link_<CODE>", () => {
    expect(parseStartLinkPayload("/start link_ABC23456")).toBe("ABC23456");
  });

  it("parses /start <CODE> without link_ prefix", () => {
    expect(parseStartLinkPayload("/start ABC23456")).toBe("ABC23456");
  });

  it("uppercases lowercase codes", () => {
    expect(parseStartLinkPayload("/start link_abc23456")).toBe("ABC23456");
  });

  it("handles bot mention /start@MyBot link_<CODE>", () => {
    expect(parseStartLinkPayload("/start@StudyflowBot link_XYZ78923")).toBe("XYZ78923");
  });

  it("returns null for /start without payload", () => {
    expect(parseStartLinkPayload("/start")).toBeNull();
  });

  it("returns null for non-start commands", () => {
    expect(parseStartLinkPayload("/help")).toBeNull();
    expect(parseStartLinkPayload("hello world")).toBeNull();
  });

  it("returns null for too-short codes", () => {
    expect(parseStartLinkPayload("/start AB")).toBeNull();
  });

  it("ignores leading/trailing whitespace in code", () => {
    expect(parseStartLinkPayload("/start  ABC23456  ")).toBe("ABC23456");
  });
});
