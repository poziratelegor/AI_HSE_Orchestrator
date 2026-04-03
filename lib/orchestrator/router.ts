import { executeWorkflow } from "@/lib/orchestrator/executor";
import { buildFallbackResponse } from "@/lib/orchestrator/fallback";
import { classifyIntent } from "@/lib/orchestrator/classify";
import { ORCHESTRATOR_THRESHOLDS } from "@/lib/orchestrator/policies";

type OrchestratorInput = {
  text: string;
  channel: "web" | "telegram";
  attachments?: unknown[];
  /** Auth user id — passed from route handler, forwarded to workflows that need it (e.g. rag_qa) */
  userId?: string;
};

export async function orchestrate(input: OrchestratorInput) {
  const classification = classifyIntent(input.text);

  if (classification.needsClarification) {
    return {
      ok: true,
      workflow: "route_recommender",
      summary: "Нужно уточнение",
      data: {
        question: classification.clarificationQuestion
      }
    };
  }

  if (classification.confidence < ORCHESTRATOR_THRESHOLDS.recommend) {
    return buildFallbackResponse();
  }

  const result = await executeWorkflow(classification.intent, input.text, {
    userId: input.userId
  });

  return {
    ok: true,
    channel: input.channel,
    intent: classification.intent,
    confidence: classification.confidence,
    reason: classification.reason,
    result
  };
}
