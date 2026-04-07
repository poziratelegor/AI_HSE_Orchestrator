export async function runQuizGenerator(text: string) {
  return {
    ok: true,
    workflow: "quiz_generator",
    summary: "Quiz Generator placeholder",
    data: {
      questions: [
        {
          question: "Что является ключевой идеей темы?",
          options: ["Вариант A", "Вариант B", "Вариант C"],
          correctAnswer: "Вариант A"
        }
      ],
      sourceText: text
    }
  };
}
