import type { WorkflowName } from "@/lib/constants/workflows";
import { WORKFLOW_REGISTRY } from "@/lib/orchestrator/registry";

/** Optional context passed from the route handler into each workflow. */
export interface WorkflowContext {
  userId?: string;
}

export async function executeWorkflow(
  intent: WorkflowName,
  text: string,
  ctx?: WorkflowContext
) {
  const workflow = WORKFLOW_REGISTRY[intent];

  if (!workflow) {
    return {
      ok: false,
      workflow: intent,
      summary: "Unknown workflow",
      data: null
    };
  }

  return workflow.run(text, ctx);
}
