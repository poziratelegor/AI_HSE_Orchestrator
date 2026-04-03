import type { WorkflowName } from "@/lib/constants/workflows";
import type { WorkflowContext } from "@/lib/orchestrator/executor";
import { runCheatSheet } from "@/lib/services/cheatsheet";
import { runExplainThis } from "@/lib/services/explain";
import { runLectureInsight } from "@/lib/services/lecture-insight";
import { runLetterGenerator } from "@/lib/services/letters";
import { runStudyPlan } from "@/lib/services/planner";
import { runQuizGenerator } from "@/lib/services/quiz";
import { runRagQa } from "@/lib/services/rag-qa";
import { runTaskExtractor } from "@/lib/services/tasks";

export type WorkflowDefinition = {
  name: WorkflowName;
  keywords: string[];
  minConfidence: number;
  requiredInputs: string[];
  run: (text: string, ctx?: WorkflowContext) => Promise<unknown>;
};

export const WORKFLOW_REGISTRY: Record<WorkflowName, WorkflowDefinition> = {
  lecture_insight: {
    name: "lecture_insight",
    keywords: ["лекц", "конспект", "запись", "аудио"],
    minConfidence: 0.75,
    requiredInputs: ["text_or_audio"],
    run: runLectureInsight
  },
  rag_qa: {
    name: "rag_qa",
    keywords: ["по материал", "по документ", "вопрос по", "найди в материалах"],
    minConfidence: 0.75,
    requiredInputs: ["question", "document_context"],
    run: runRagQa
  },
  letter_generator: {
    name: "letter_generator",
    keywords: ["письм", "заявлен", "обращени", "деканат", "преподавател"],
    minConfidence: 0.75,
    requiredInputs: ["text"],
    run: runLetterGenerator
  },
  task_extractor: {
    name: "task_extractor",
    keywords: ["дедлайн", "что нужно сделать", "задач", "срок"],
    minConfidence: 0.75,
    requiredInputs: ["text"],
    run: runTaskExtractor
  },
  study_plan: {
    name: "study_plan",
    keywords: ["план", "подготов", "экзамен", "расписание"],
    minConfidence: 0.7,
    requiredInputs: ["text"],
    run: runStudyPlan
  },
  explain_this: {
    name: "explain_this",
    keywords: ["объясни", "простыми словами", "упрости", "не понимаю"],
    minConfidence: 0.75,
    requiredInputs: ["text_or_document"],
    run: runExplainThis
  },
  cheat_sheet: {
    name: "cheat_sheet",
    keywords: ["шпаргал", "cheat sheet", "кратко по теме", "сжато"],
    minConfidence: 0.75,
    requiredInputs: ["text_or_document"],
    run: runCheatSheet
  },
  quiz_generator: {
    name: "quiz_generator",
    keywords: ["тест", "quiz", "вопросы", "карточки"],
    minConfidence: 0.75,
    requiredInputs: ["text_or_document"],
    run: runQuizGenerator
  },
  route_recommender: {
    name: "route_recommender",
    keywords: [],
    minConfidence: 0,
    requiredInputs: ["text"],
    run: async () => ({
      ok: true,
      workflow: "route_recommender",
      summary: "Нужна рекомендация маршрута",
      data: {
        recommendation: "Уточни тип задачи: лекция, письмо, задачи, шпаргалка или RAG-вопрос."
      }
    })
  }
};
