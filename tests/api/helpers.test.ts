import { describe, it, expect } from "vitest";
import { apiError, ERRORS } from "@/lib/api/helpers";

describe("apiError", () => {
  it("returns structured error response", () => {
    const res = apiError("test_error", "Test message", 400);
    expect(res.status).toBe(400);
  });

  it("defaults to status 400", () => {
    const res = apiError("test_error");
    expect(res.status).toBe(400);
  });
});

describe("ERRORS presets", () => {
  it("UNAUTHORIZED returns 401", () => {
    const res = ERRORS.UNAUTHORIZED();
    expect(res.status).toBe(401);
  });

  it("INVALID_INPUT returns 400 with message", () => {
    const res = ERRORS.INVALID_INPUT("Bad input");
    expect(res.status).toBe(400);
  });

  it("INTERNAL returns 500", () => {
    const res = ERRORS.INTERNAL();
    expect(res.status).toBe(500);
  });

  it("INTERNAL accepts custom message", () => {
    const res = ERRORS.INTERNAL("Custom error");
    expect(res.status).toBe(500);
  });
});
