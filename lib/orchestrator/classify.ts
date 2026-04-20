import { AVAILABLE_WORKFLOWS, type WorkflowName } from "@/lib/constants/workflows";
import { WORKFLOW_REGISTRY } from "@/lib/orchestrator/registry";
import { classifyIntentLLM } from "@/lib/orchestrator/classify-llm";

export type ClassificationResult = {
  intent: WorkflowName;
  confidence: number;
  reason: string;
  needsClarification: boolean;
  clarificationQuestion: string | null;
};

function classifyByRegistry(inputText: string): ClassificationResult {
  const text = inputText.toLowerCase();

  for (const workflow of Object.values(WORKFLOW_REGISTRY)) {
    const matchedKeyword = workflow.keywords.find((keyword) => text.includes(keyword));

    if (matchedKeyword) {
      return {
        intent: workflow.name,
        confidence: workflow.minConfidence,
        reason: `Найден сигнал для workflow ${workflow.name}: ${matchedKeyword}`,
        needsClarification: false,
        clarificationQuestion: null
      };
    }
  }

  return {
    intent: "route_recommender",
    confidence: 0.4,
    reason: "Недостаточно сигналов для однозначного выбора workflow.",
    needsClarification: false,
    clarificationQuestion: null
  };
}

/**
 * Classifies intent using LLM-first strategy with keyword fallback.
 *
 * Strategy:
 *   1. Try LLM classification (async, 8s timeout).
 *   2. If LLM result has confidence >= 0.75 → use LLM result.
 *   3. Otherwise run keyword matching.
 *   4. Use whichever has higher confidence.
 *
 * LLM is disabled if OPENAI_API_KEY is missing (e.g., local dev without key).
 */
export async function classifyIntent(inputText: string): Promise<ClassificationResult> {
  try {
    // Run LLM and keyword classification concurrently
    const [llmResult, keywordResult] = await Promise.all([
      classifyIntentLLM(inputText),
      Promise.resolve(classifyByRegistry(inputText))
    ]);

    // If LLM returned a confident result, prefer it
    if (llmResult && llmResult.confidence >= 0.75) {
      return llmResult;
    }

    // If keyword matched with high confidence, use it
    if (keywordResult.confidence >= 0.75) {
      return keywordResult;
    }

    // Both are uncertain — return whichever has higher confidence
    if (llmResult && llmResult.confidence > keywordResult.confidence) {
      return llmResult;
    }

    return keywordResult;
  } catch {
    return {
      intent: "route_recommender",
      confidence: 0.3,
      reason: "classification_failed_fallback",
      needsClarification: true,
      clarificationQuestion:
        "Уточни, что именно нужно: письмо, шпаргалка, поиск по материалам, задачи или разбор лекции?"
    };
  }
}

export function isKnownWorkflow(intent: string): intent is WorkflowName {
  return AVAILABLE_WORKFLOWS.includes(intent as WorkflowName);
}
