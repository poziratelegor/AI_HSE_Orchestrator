import type { WorkflowName } from "@/lib/constants/workflows";
import { WORKFLOW_REGISTRY } from "@/lib/orchestrator/registry";

export async function executeWorkflow(intent: WorkflowName, text: string) {
  const workflow = WORKFLOW_REGISTRY[intent];

  if (!workflow) {
    return {
      ok: false,
      workflow: intent,
      summary: "Unknown workflow",
      data: null
    };
  }

  return workflow.run(text);
}
