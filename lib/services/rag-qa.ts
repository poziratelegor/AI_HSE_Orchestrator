export async function runRagQa(text: string) {
  return {
    ok: true,
    workflow: "rag_qa",
    summary: "RAG Q&A placeholder",
    data: {
      answer: `Ответ на вопрос по базе знаний: ${text}`,
      citations: []
    }
  };
}
