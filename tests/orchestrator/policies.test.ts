import { describe, it, expect } from "vitest";
import { ORCHESTRATOR_THRESHOLDS } from "@/lib/orchestrator/policies";

describe("ORCHESTRATOR_THRESHOLDS", () => {
  it("has execute threshold at 0.75", () => {
    expect(ORCHESTRATOR_THRESHOLDS.execute).toBe(0.75);
  });

  it("has recommend threshold at 0.45", () => {
    expect(ORCHESTRATOR_THRESHOLDS.recommend).toBe(0.45);
  });

  it("execute is greater than recommend", () => {
    expect(ORCHESTRATOR_THRESHOLDS.execute).toBeGreaterThan(ORCHESTRATOR_THRESHOLDS.recommend);
  });
});
