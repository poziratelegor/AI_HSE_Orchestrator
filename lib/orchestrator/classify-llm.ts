import { getOpenAIClient, DEFAULT_MODEL } from "@/lib/ai/client";
import { withRetry } from "@/lib/ai/retry";
import { buildClassifyPrompt } from "@/lib/ai/prompts";
import type { ClassificationResult } from "@/lib/orchestrator/classify";
import { WORKFLOW_REGISTRY } from "@/lib/orchestrator/registry";

/**
 * Builds the workflow descriptions block for the system prompt.
 * Derived dynamically from WORKFLOW_REGISTRY so it stays in sync.
 */
function buildWorkflowDescriptions(): string {
  const descriptions: Record<string, string> = {
    lecture_insight:
      "Обработка лекций: конспектирование, краткое содержание аудио/текста лекции",
    rag_qa:
      "Поиск по загруженным материалам: вопросы по документам студента, поиск в базе знаний",
    letter_generator:
      "Генерация писем и заявлений: академические письма, обращения к деканату/преподавателям",
    task_extractor:
      "Извлечение задач и дедлайнов из текста: списки дел, сроки сдачи, задания",
    study_plan:
      "Составление учебного плана: расписание подготовки к экзаменам, план изучения темы",
    explain_this:
      "Объяснение сложных концепций простыми словами: разбор теорий, терминов, задач",
    cheat_sheet:
      "Создание шпаргалок: краткие конспекты, ключевые формулы и определения по теме",
    quiz_generator:
      "Генерация тестов и карточек: вопросы для самопроверки, квизы по материалу",
    route_recommender:
      "Использовать если запрос неоднозначен, не подходит ни к одному workflow, или требует уточнения"
  };

  return Object.entries(WORKFLOW_REGISTRY)
    .map(([name]) => `- ${name}: ${descriptions[name] ?? name}`)
    .join("\n");
}

// Build the classify prompt once at module load — it's static after build.
// Few-shot examples + JSON schema are embedded by buildClassifyPrompt().
const CLASSIFY_SYSTEM_PROMPT = buildClassifyPrompt(buildWorkflowDescriptions());

/**
 * Classifies user intent using GPT.
 * Falls back to keyword-based classification on any error.
 */
export async function classifyIntentLLM(
  inputText: string
): Promise<ClassificationResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const completion = await withRetry(() =>
      openai.chat.completions.create(
        {
          model: DEFAULT_MODEL,
          temperature: 0,
          max_tokens: 200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: CLASSIFY_SYSTEM_PROMPT },
            { role: "user", content: inputText }
          ]
        },
        { signal: controller.signal }
      )
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const intent = parsed.intent as string;
    const confidence = Number(parsed.confidence ?? 0);
    const reason = (parsed.reason as string) ?? "LLM classification";
    const needsClarification = Boolean(parsed.needs_clarification);
    const clarificationQuestion =
      typeof parsed.clarification_question === "string" && parsed.clarification_question
        ? parsed.clarification_question
        : null;

    // Validate intent is a known workflow
    if (!(intent in WORKFLOW_REGISTRY)) {
      return null;
    }

    return {
      intent: intent as ClassificationResult["intent"],
      confidence,
      reason,
      needsClarification,
      clarificationQuestion
    };
  } catch (err) {
    console.warn("[classify-llm] LLM classification failed, falling back:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
