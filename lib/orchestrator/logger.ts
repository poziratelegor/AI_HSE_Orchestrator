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
    const { error } = await supabase.from("orchestrator_runs").insert({
      user_id: input.userId,
      input_text: input.inputText,
      detected_intent: input.detectedIntent,
      confidence: input.confidence,
      selected_workflow: input.selectedWorkflow,
      status: input.status,
      channel: input.channel,
      latency_ms: Math.max(1, Math.round(input.latencyMs))
    });

    if (error) {
      console.error("[orchestrator_runs] insert failed:", error);
    }
  } catch (err) {
    console.error("[orchestrator_runs] insert failed:", err);
  }
}
