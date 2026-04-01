export function buildFallbackResponse() {
  return {
    ok: true,
    workflow: "route_recommender",
    summary: "Не удалось уверенно выбрать сценарий.",
    data: {
      suggestion:
        "Уточни, что именно нужно: разобрать лекцию, задать вопрос по документам, написать письмо, выделить задачи или сделать шпаргалку."
    }
  };
}
