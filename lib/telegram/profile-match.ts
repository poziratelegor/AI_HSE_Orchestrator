export type ProfileCandidate = {
  id: string;
  full_name: string | null;
  group_name: string | null;
  faculty?: string | null;
  program?: string | null;
  course_number?: number | null;
};

export type TelegramIdentity = {
  firstName?: string;
  lastName?: string;
  username?: string;
};

export type ProfileMatchResult = {
  profile: ProfileCandidate;
  score: number;
  reason: string[];
};

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9\s-]/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return normalize(value)
    .split(/[\s-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function overlapScore(left: string, right: string): number {
  const a = new Set(tokens(left));
  const b = new Set(tokens(right));
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }

  return overlap / Math.max(a.size, b.size);
}

export function scoreProfileMatch(
  profile: ProfileCandidate,
  query: string,
  identity?: TelegramIdentity
): ProfileMatchResult {
  const reason: string[] = [];
  let score = 0;

  const name = normalize(profile.full_name);
  const group = normalize(profile.group_name);
  const q = normalize(query);

  const queryNameOverlap = overlapScore(name, q);
  if (queryNameOverlap > 0) {
    score += Math.min(0.7, queryNameOverlap * 0.8);
    reason.push("name_query");
  }

  const queryGroupOverlap = overlapScore(group, q);
  if (queryGroupOverlap > 0) {
    score += Math.min(0.4, queryGroupOverlap * 0.6);
    reason.push("group_query");
  }

  const tgName = normalize([identity?.firstName, identity?.lastName].filter(Boolean).join(" "));
  const tgUsername = normalize(identity?.username);

  const tgNameOverlap = overlapScore(name, tgName);
  if (tgNameOverlap >= 0.4) {
    score += 0.25;
    reason.push("name_telegram");
  }

  if (tgUsername && name.includes(tgUsername)) {
    score += 0.15;
    reason.push("username_in_name");
  }

  if (q && (name === q || group === q)) {
    score += 0.3;
    reason.push("exact_match");
  }

  return {
    profile,
    score: Math.min(1, Number(score.toFixed(4))),
    reason,
  };
}

export function rankProfileMatches(
  profiles: ProfileCandidate[],
  query: string,
  identity?: TelegramIdentity,
  minScore = 0.45
): ProfileMatchResult[] {
  return profiles
    .map((profile) => scoreProfileMatch(profile, query, identity))
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
