export async function runLectureInsight(text: string) {
  return {
    ok: true,
    workflow: "lecture_insight",
    summary: "Lecture Insight placeholder",
    data: {
      sourceTextLength: text.length,
      topics: [],
      terms: [],
      shortSummary: "Здесь будет краткий конспект лекции."
    }
  };
}
