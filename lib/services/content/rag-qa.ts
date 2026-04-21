import type { WorkflowContext } from "@/lib/orchestrator/executor";
import { buildCitations } from "@/lib/rag/citations";
import { retrieveRelevantChunks, type RetrievedChunk } from "@/lib/rag/retrieve";
import { expandQuery } from "@/lib/rag/expand-query";
import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { guardContext } from "@/lib/ai/token-guard";
import { buildRagQaPrompt } from "@/lib/ai/prompts";
import { loadStudentContext } from "@/lib/ai/student-context";

const MAX_CHUNKS = 8;
const RETRIEVAL_THRESHOLD = 0.42;

/**
 * Deduplicates retrieved chunks by chunk id, keeping the highest similarity score.
 * Sorts result by similarity descending, then trims to MAX_CHUNKS.
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

export async function runRagQa(text: string, ctx?: WorkflowContext): Promise<unknown> {
  const userId = ctx?.userId;

  if (!userId) {
    return {
      ok: false,
      workflow: "rag_qa",
      error: "Требуется авторизация для поиска по материалам"
    };
  }

  // 1. Load student context (cached) and expand query in parallel
  const [studentCtx, queries] = await Promise.all([
    loadStudentContext(userId),
    expandQuery(text)
  ]);

  // 2. Retrieve chunks for each query variant in parallel
  const retrievalResults = await Promise.all(
    queries.map((q) =>
      retrieveRelevantChunks(q, userId, {
        matchThreshold: RETRIEVAL_THRESHOLD,
        matchCount: 6
      })
    )
  );

  // 3. Merge, deduplicate, sort
  const allChunks = deduplicateChunks(retrievalResults.flat());

  if (allChunks.length === 0) {
    return {
      ok: true,
      workflow: "rag_qa",
      data: {
        answer:
          "В базе знаний не найдено материалов по этому вопросу. " +
          "Попробуйте загрузить соответствующие документы через раздел «Документы».",
        citations: [],
        found_context: false
      }
    };
  }

  // 4. Build personalized system prompt with student context
  const systemPrompt = buildRagQaPrompt(studentCtx);

  // 5. Guard context length before building user message
  const model = DEFAULT_MODEL;
  const safeChunks = guardContext(allChunks, model, systemPrompt.length, text.length);

  // 6. Build numbered context block (ordered by relevance)
  const contextBlock = safeChunks
    .map((chunk, i) => `[${i + 1}] (из «${chunk.document_title}»)\n${chunk.chunk_text}`)
    .join("\n\n---\n\n");

  // 7. Generate answer with retry
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create(
        {
          model,
          temperature: 0.15,
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `КОНТЕКСТ ИЗ ЗАГРУЖЕННЫХ МАТЕРИАЛОВ:\n\n${contextBlock}\n\n---\n\nВОПРОС СТУДЕНТА:\n${text}`
            }
          ]
        },
        { signal: controller.signal }
      )
    );

    const answer =
      completion.choices[0]?.message?.content?.trim() ?? "Не удалось сформировать ответ.";
    const citations = buildCitations(safeChunks);

    return {
      ok: true,
      workflow: "rag_qa",
      data: {
        answer,
        citations,
        found_context: true,
        chunks_used: safeChunks.length,
        queries_used: queries.length
      }
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка OpenAI при обработке запроса.";
    return {
      ok: false,
      workflow: "rag_qa",
      error: "openai_error",
      message
    };
  } finally {
    clearTimeout(timeout);
  }
}
