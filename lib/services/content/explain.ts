export async function runExplainThis(text: string) {
  return {
    ok: true,
    workflow: "explain_this",
    summary: "Explain This placeholder",
    data: {
      simplifiedExplanation: `Упрощённое объяснение: ${text}`
    }
  };
}
