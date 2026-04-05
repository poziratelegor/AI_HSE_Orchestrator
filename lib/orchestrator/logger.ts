import { getSupabaseServerClient } from "@/lib/supabase/server";

export type OrchestratorRunStatus = "completed" | "fallback" | "clarification" | "failed";

type LogOrchestratorRunInput = {
  userId?: string;
  inputText: string;
  detectedIntent: string;
  confidence: number;
  selectedWorkflow: string;
  status: OrchestratorRunStatus;
  channel: "web" | "telegram";
  latencyMs: number;
};

export async function logOrchestratorRun(input: LogOrchestratorRunInput) {
  if (!input.userId) return;

  try {
    const supabase = getSupabaseServerClient();
    const basePayload = {
      user_id: input.userId,
      input_text: input.inputText,
      detected_intent: input.detectedIntent,
      confidence: input.confidence,
      selected_workflow: input.selectedWorkflow,
      status: input.status
    };

    const { error } = await supabase.from("orchestrator_runs").insert({
      ...basePayload,
      channel: input.channel,
      latency_ms: Math.max(1, Math.round(input.latencyMs))
    });

    if (error) {
      const maybeMissingColumn =
        error.message.includes("channel") || error.message.includes("latency_ms");

      if (!maybeMissingColumn) {
        console.error("[orchestrator_runs] insert failed:", error);
        return;
      }

      const { error: fallbackError } = await supabase.from("orchestrator_runs").insert(basePayload);

      if (fallbackError) {
        console.error("[orchestrator_runs] insert failed:", fallbackError);
      }
    }
  } catch (err) {
    console.error("[orchestrator_runs] insert failed:", err);
  }
}
