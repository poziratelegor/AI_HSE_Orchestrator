export async function runTaskExtractor(text: string) {
  return {
    ok: true,
    workflow: "task_extractor",
    summary: "Task Extractor placeholder",
    data: {
      extractedTasks: [
        {
          title: "Проверить текст и выделить задачи",
          dueDate: null
        }
      ],
      sourceText: text
    }
  };
}
