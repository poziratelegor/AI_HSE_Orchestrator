import { getSupabaseUserFromRequest } from "@/lib/supabase/server";
import { ERRORS } from "@/lib/api/helpers";
import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { buildRagQaPrompt } from "@/lib/ai/prompts";
import { expandQuery } from "@/lib/rag/expand-query";
import { retrieveRelevantChunks, type RetrievedChunk } from "@/lib/rag/retrieve";
import { buildCitations } from "@/lib/rag/citations";
import { guardContext } from "@/lib/ai/token-guard";
import { loadStudentContext } from "@/lib/ai/student-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHUNKS = 8;
const RETRIEVAL_THRESHOLD = 0.42;

type StreamEvent =
  | { delta: string }
  | { done: true; citations: Array<{ index: number; documentTitle?: string; excerpt: string }> }
  | { error: string };

function encode(obj: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(obj)}\n`);
}

/**
 * Mirrors the dedup logic in lib/services/content/rag-qa.ts so the streaming
 * endpoint returns the same chunks as the non-streaming one.
 */
function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Map<string, RetrievedChunk>();
  for (const chunk of chunks) {
    const existing = seen.get(chunk.id);
    if (!existing || chunk.similarity > existing.similarity) {
      seen.set(chunk.id, chunk);
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CHUNKS);
}

export async function POST(request: Request) {
  // 1. Auth
  const { user } = await getSupabaseUserFromRequest(request);
  if (!user) return ERRORS.UNAUTHORIZED();

  // 2. Validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ERRORS.INVALID_INPUT("Тело запроса должно быть валидным JSON.");
  }

  const { query } = body as Record<string, unknown>;
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return ERRORS.INVALID_INPUT("Поле 'query' обязательно.");
  }

  const trimmedQuery = query.trim();

  // 3. Build context (synchronously before stream starts)
  const [studentContext, queries] = await Promise.all([
    loadStudentContext(user.id),
    expandQuery(trimmedQuery)
  ]);

  const retrievalResults = await Promise.all(
    queries.map((q) =>
      retrieveRelevantChunks(q, user.id, {
        matchThreshold: RETRIEVAL_THRESHOLD,
        matchCount: 6
      })
    )
  );

  const chunks = deduplicateChunks(retrievalResults.flat());

  if (chunks.length === 0) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encode({
            delta:
              "По загруженным документам ничего не нашлось. Попробуй переформулировать запрос или загрузи материал в раздел «Документы»."
          })
        );
        controller.enqueue(encode({ done: true, citations: [] }));
        controller.close();
      }
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8" }
    });
  }

  const systemPrompt = buildRagQaPrompt(studentContext);
  const guarded = guardContext(chunks, DEFAULT_MODEL, systemPrompt.length, trimmedQuery.length);

  // Map citations to UI-friendly shape: index, documentTitle, excerpt.
  const citations = buildCitations(guarded).map((c, i) => ({
    index: i + 1,
    documentTitle: c.document_title,
    excerpt: c.excerpt
  }));

  const contextBlock = guarded
    .map((c, i) => `[${i + 1}] (из «${c.document_title}»)\n${c.chunk_text}`)
    .join("\n\n---\n\n");

  // 4. Open OpenAI streaming
  const openai = getOpenAIClient();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await openai.chat.completions.create({
          model: DEFAULT_MODEL,
          temperature: 0.15,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `КОНТЕКСТ ИЗ ЗАГРУЖЕННЫХ МАТЕРИАЛОВ:\n\n${contextBlock}\n\n---\n\nВОПРОС СТУДЕНТА:\n${trimmedQuery}`
            }
          ]
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encode({ delta }));
          }
        }

        controller.enqueue(encode({ done: true, citations }));
        controller.close();
      } catch (err) {
        console.error("[api/rag/query/stream] OpenAI stream error:", err);
        controller.enqueue(encode({ error: err instanceof Error ? err.message : "Stream error" }));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no" // disable proxy buffering
    }
  });
}
