export const ANALYTICS_EVENTS = {
  ORCHESTRATE_SUCCESS: "orchestrate_success",
  ORCHESTRATE_FALLBACK: "orchestrate_fallback",
  ORCHESTRATE_ERROR: "orchestrate_error",
  DOCUMENT_UPLOADED: "document_uploaded",
  DOCUMENT_READY: "document_ready",
  DOCUMENT_FAILED: "document_failed",
  LETTER_GENERATED: "letter_generated",
  FIRST_QUERY: "first_query"
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export const ANALYTICS_CHANNELS = ["web", "telegram"] as const;

export type AnalyticsChannel = (typeof ANALYTICS_CHANNELS)[number];
