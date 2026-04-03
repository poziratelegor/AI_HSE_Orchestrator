import { NextResponse } from "next/server";
import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";

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

  // 3. Вызов сервиса
  // TODO: вызвать retrieveRelevantChunks() + runRagQa() из lib/services/rag-qa.ts
  return NextResponse.json({
    ok: true,
    workflow: "rag_qa",
    answer: null,
    sources: [],
    message: "RAG pipeline не реализован."
  });
}

