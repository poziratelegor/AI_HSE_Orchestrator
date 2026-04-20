import { ANALYTICS_EVENTS } from "@/lib/constants/analytics";

export const FUNNEL_STEPS = [
  "landing_view",
  "signup_complete",
  ANALYTICS_EVENTS.FIRST_QUERY,
  "first_workflow_success",
  "repeat_usage"
] as const;
