import type { WorkflowContext } from "@/lib/orchestrator/executor";
import { buildCitations } from "@/lib/rag/citations";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { getOpenAIClient } from "@/lib/openai/client";

const SYSTEM_PROMPT = `
Ты — учебный ассистент StudyFlow AI. Отвечай ТОЛЬКО на основе предоставленного контекста.
Правила:
- Если ответ есть в контексте — дай точный, структурированный ответ на русском.
- Ссылайся на источники через [1], [2] и т.д. в соответствии с нумерацией контекста.
- Если в контексте нет достаточной информации — честно скажи об этом, не придумывай.
- Не добавляй информацию, которой нет в контексте.
- Формат ответа: лаконично и по делу, без воды.
`.trim();

export async function runRagQa(text: string, ctx?: WorkflowContext): Promise<unknown> {
  const userId = ctx?.userId;

  if (!userId) {
    return {
      ok: false,
      workflow: "rag_qa",
      error: "Требуется авторизация для поиска по материалам"
    };
  }

  // 1. Retrieve relevant chunks from the user's documents
  const chunks = await retrieveRelevantChunks(text, userId, {
    matchThreshold: 0.45,
    matchCount: 6
  });

  if (chunks.length === 0) {
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

  // 2. Build numbered context block
  const contextBlock = chunks.map((chunk, i) => `[${i + 1}] ${chunk.chunk_text}`).join("\n\n");

  // 3. Ask GPT to answer based strictly on the context
  const openai = getOpenAIClient();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `КОНТЕКСТ ИЗ ЗАГРУЖЕННЫХ МАТЕРИАЛОВ:\n\n${contextBlock}\n\nВОПРОС СТУДЕНТА:\n${text}`
      }
    ]
  });

  const answer = completion.choices[0]?.message?.content?.trim() ?? "Не удалось сформировать ответ.";
  const citations = buildCitations(chunks);

  return {
    ok: true,
    workflow: "rag_qa",
    data: {
      answer,
      citations,
      found_context: true,
      chunks_used: chunks.length
    }
  };
}
