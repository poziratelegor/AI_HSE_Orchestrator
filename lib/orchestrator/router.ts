import { executeWorkflow } from "@/lib/orchestrator/executor";
import { buildFallbackResponse } from "@/lib/orchestrator/fallback";
import { classifyIntent } from "@/lib/orchestrator/classify";
import { ORCHESTRATOR_THRESHOLDS } from "@/lib/orchestrator/policies";
import { logOrchestratorRun, type OrchestratorRunStatus } from "@/lib/orchestrator/logger";

type OrchestratorInput = {
  text: string;
  channel: "web" | "telegram";
  attachments?: unknown[];
  /** Auth user id — passed from route handler, forwarded to workflows that need it (e.g. rag_qa) */
  userId?: string;
};

export async function orchestrate(input: OrchestratorInput) {
  const startedAt = Date.now();
  const classification = await classifyIntent(input.text);

  const logRun = (status: OrchestratorRunStatus, selectedWorkflow: string) => {
    void logOrchestratorRun({
      userId: input.userId,
      inputText: input.text,
      detectedIntent: classification.intent,
      confidence: classification.confidence,
      selectedWorkflow,
      status,
      channel: input.channel,
      latencyMs: Date.now() - startedAt
    });
  };

  if (classification.needsClarification) {
    logRun("clarification", "route_recommender");
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
    logRun("fallback", "route_recommender");
    return buildFallbackResponse();
  }

  // Recommend zone: confidence between recommend (0.45) and execute (0.75)
  // Still execute but include recommendation context so the client can show a hint
  const isRecommendZone =
    classification.confidence >= ORCHESTRATOR_THRESHOLDS.recommend &&
    classification.confidence < ORCHESTRATOR_THRESHOLDS.execute;

  try {
    const result = await executeWorkflow(classification.intent, input.text, {
      userId: input.userId
    });

    const status = (result as { ok?: boolean })?.ok === false ? "failed" : "completed";
    logRun(status, classification.intent);

    return {
      ok: true,
      channel: input.channel,
      intent: classification.intent,
      confidence: classification.confidence,
      reason: classification.reason,
      ...(isRecommendZone && {
        lowConfidence: true,
        suggestion: `Выбран сценарий «${classification.intent}» с уверенностью ${Math.round(classification.confidence * 100)}%. Если результат неточный — уточните запрос.`
      }),
      result
    };
  } catch (err) {
    logRun("failed", classification.intent);
    throw err;
  }
}
