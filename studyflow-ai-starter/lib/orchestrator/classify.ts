import { AVAILABLE_WORKFLOWS, type WorkflowName } from "@/lib/constants/workflows";
import { WORKFLOW_REGISTRY } from "@/lib/orchestrator/registry";

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

export function classifyIntent(inputText: string): ClassificationResult {
  try {
    return classifyByRegistry(inputText);
  } catch {
    return {
      intent: "route_recommender",
      confidence: 0.3,
      reason: "classification_failed_fallback",
      needsClarification: true,
      clarificationQuestion: "Уточни, что именно нужно: письмо, шпаргалка, поиск по материалам, задачи или разбор лекции?"
    };
  }
}

export function isKnownWorkflow(intent: string): intent is WorkflowName {
  return AVAILABLE_WORKFLOWS.includes(intent as WorkflowName);
}
