import { describe, expect, it } from "vitest";
import { rankProfileMatches, scoreProfileMatch } from "@/lib/telegram/profile-match";

describe("scoreProfileMatch", () => {
  const profile = {
    id: "u-1",
    full_name: "Иванов Иван Иванович",
    group_name: "ПМИ-221",
  };

  it("gives high score for close full-name + group query", () => {
    const result = scoreProfileMatch(profile, "Иванов Иван ПМИ-221", {
      firstName: "Ivan",
      lastName: "Ivanov",
      username: "ivanov",
    });

    expect(result.score).toBeGreaterThan(0.6);
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it("keeps low score for unrelated query", () => {
    const result = scoreProfileMatch(profile, "Петров ППИ-101");
    expect(result.score).toBeLessThan(0.45);
  });
});

describe("rankProfileMatches", () => {
  it("returns candidates sorted by score and applies threshold", () => {
    const profiles = [
      { id: "u-1", full_name: "Иванов Иван", group_name: "ПМИ-221" },
      { id: "u-2", full_name: "Петров Петр", group_name: "БИ-102" },
    ];

    const ranked = rankProfileMatches(profiles, "Иванов ПМИ-221", undefined, 0.4);

    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.profile.id).toBe("u-1");
  });
});
