export const AVAILABLE_WORKFLOWS = [
  "lecture_insight",
  "rag_qa",
  "letter_generator",
  "task_extractor",
  "study_plan",
  "explain_this",
  "cheat_sheet",
  "quiz_generator",
  "route_recommender"
] as const;

export type WorkflowName = (typeof AVAILABLE_WORKFLOWS)[number];
