export const orchestratorSchema = {
  type: "object",
  properties: {
    intent: { type: "string" },
    confidence: { type: "number" },
    reason: { type: "string" },
    needs_clarification: { type: "boolean" },
    clarification_question: {
      type: ["string", "null"]
    }
  },
  required: [
    "intent",
    "confidence",
    "reason",
    "needs_clarification",
    "clarification_question"
  ],
  additionalProperties: false
} as const;
