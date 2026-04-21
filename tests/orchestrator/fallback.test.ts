import { describe, it, expect } from "vitest";
import { buildFallbackResponse } from "@/lib/orchestrator/fallback";

describe("buildFallbackResponse", () => {
  it("returns ok: true", () => {
    const response = buildFallbackResponse();
    expect(response.ok).toBe(true);
  });

  it("returns route_recommender workflow", () => {
    const response = buildFallbackResponse();
    expect(response.workflow).toBe("route_recommender");
  });

  it("includes helpful suggestion", () => {
    const response = buildFallbackResponse();
    expect(response.data.suggestion).toBeTruthy();
    expect(typeof response.data.suggestion).toBe("string");
  });
});
