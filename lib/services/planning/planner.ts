export async function runStudyPlan(text: string) {
  return {
    ok: true,
    workflow: "study_plan",
    summary: "Study Plan placeholder",
    data: {
      input: text,
      plan: [
        "День 1: собрать материалы",
        "День 2: пройти ключевые темы",
        "День 3: повторение и самопроверка"
      ]
    }
  };
}
