import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { createLogger } from "@/lib/logger";

const logger = createLogger("lecture-notes");

export type LectureNotesResult = {
  title: string;
  summary: string;
  keyPoints: string[];
  definitions: { term: string; definition: string }[];
  actionItems: string[];
};

const SYSTEM_PROMPT = `Ты академический ассистент. По транскрипту лекции составь структурированный конспект.

Верни JSON строго по схеме:
{
  "title": "Название темы лекции",
  "summary": "Краткое резюме (3-5 предложений)",
  "keyPoints": ["Ключевая идея 1", "Ключевая идея 2"],
  "definitions": [{"term": "Термин", "definition": "Определение"}],
  "actionItems": ["Что нужно сделать/изучить дополнительно"]
}

Пиши по-русски. keyPoints — минимум 5, максимум 15. definitions — только если есть явные термины.`;

export async function generateLectureNotes(
  transcript: string,
  userId?: string
): Promise<LectureNotesResult> {
  const openai = getOpenAIClient();

  // Обрезать транскрипт до ~12000 токенов (≈48000 символов)
  const truncated =
    transcript.length > 48_000
      ? transcript.slice(0, 48_000) + "\n\n[транскрипт обрезан]"
      : transcript;

  logger.info("Generating lecture notes", {
    userId,
    transcriptLen: truncated.length,
  });

  const response = await withRetry(() =>
    openai.chat.completions.create({
      model: DEFAULT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `ТРАНСКРИПТ ЛЕКЦИИ:\n\n${truncated}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })
  );

  const raw = response.choices[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(raw) as LectureNotesResult;
  } catch {
    logger.warn("Failed to parse lecture notes JSON", { raw: raw.slice(0, 200) });
    return {
      title: "Конспект лекции",
      summary: raw,
      keyPoints: [],
      definitions: [],
      actionItems: [],
    };
  }
}
