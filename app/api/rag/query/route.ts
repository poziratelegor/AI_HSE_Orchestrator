import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { runRagQa } from "@/lib/services/content/rag-qa";
import { cacheGet, cacheSet } from "@/lib/cache/redis";

const RAG_CACHE_TTL = 3600; // 1 hour

function buildCacheKey(userId: string, query: string): string {
  const hash = createHash("sha256").update(query).digest("hex");
  return `rag:${userId}:${hash}`;
}

export async function POST(request: Request) {
  // 1. Auth check
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Input validation
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { question } = body as Record<string, unknown>;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'question' обязательно и должно быть непустой строкой.");
  }

  const query = question.trim();

  // 3. Cache lookup
  const cacheKey = buildCacheKey(user.id, query);
  try {
    const cached = await cacheGet(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached) as Record<string, unknown>;
      return NextResponse.json({ ...parsed, cached: true });
    }
  } catch (err) {
    // Cache miss or parse error — proceed to service call
    console.warn("[rag/query] cache get failed:", err);
  }

  // 4. Call service
  try {
    const result = await runRagQa(query, { userId: user.id });

    // 5. Store result in cache (fire-and-forget)
    try {
      await cacheSet(cacheKey, JSON.stringify(result), RAG_CACHE_TTL);
    } catch (err) {
      console.warn("[rag/query] cache set failed:", err);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/rag/query] service error:", err);
    return ERRORS.INTERNAL("Ошибка поиска по документам.");
  }
}
