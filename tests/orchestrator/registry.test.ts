import { describe, it, expect } from "vitest";
import { WORKFLOW_REGISTRY } from "@/lib/orchestrator/registry";
import { AVAILABLE_WORKFLOWS } from "@/lib/constants/workflows";

describe("WORKFLOW_REGISTRY", () => {
  it("has entry for every workflow in AVAILABLE_WORKFLOWS", () => {
    for (const name of AVAILABLE_WORKFLOWS) {
      expect(WORKFLOW_REGISTRY[name]).toBeDefined();
      expect(WORKFLOW_REGISTRY[name].name).toBe(name);
    }
  });

  it("every workflow has a run function", () => {
    for (const [name, def] of Object.entries(WORKFLOW_REGISTRY)) {
      expect(typeof def.run).toBe("function");
    }
  });

  it("every workflow has keywords array", () => {
    for (const [name, def] of Object.entries(WORKFLOW_REGISTRY)) {
      expect(Array.isArray(def.keywords)).toBe(true);
    }
  });

  it("every workflow has minConfidence between 0 and 1", () => {
    for (const [name, def] of Object.entries(WORKFLOW_REGISTRY)) {
      expect(def.minConfidence).toBeGreaterThanOrEqual(0);
      expect(def.minConfidence).toBeLessThanOrEqual(1);
    }
  });

  it("route_recommender has no keywords and minConfidence 0", () => {
    const rr = WORKFLOW_REGISTRY.route_recommender;
    expect(rr.keywords).toHaveLength(0);
    expect(rr.minConfidence).toBe(0);
  });
});
