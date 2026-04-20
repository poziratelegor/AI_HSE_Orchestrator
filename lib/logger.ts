/**
 * Centralized structured logger for StudyFlow AI.
 *
 * In production, logs are emitted as JSON to stdout — compatible with
 * Vercel log drains, Datadog, and any log aggregation system.
 *
 * In development, logs are formatted for readability.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  service?: string;
  userId?: string;
  requestId?: string;
  durationMs?: number;
  error?: string;
  stack?: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function emit(entry: LogEntry): void {
  if (IS_PRODUCTION) {
    // Structured JSON — parseable by log aggregators
    const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
    if (entry.level === "error") {
      console.error(line);
    } else if (entry.level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  } else {
    // Human-readable in development
    const ts = new Date().toISOString().slice(11, 23);
    const prefix = `[${ts}] [${entry.level.toUpperCase()}]${entry.service ? ` [${entry.service}]` : ""}`;
    const extras = Object.entries(entry)
      .filter(([k]) => !["level", "message", "service", "stack"].includes(k))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ");

    const line = `${prefix} ${entry.message}${extras ? " | " + extras : ""}`;
    if (entry.level === "error") {
      console.error(line);
      if (entry.stack) console.error(entry.stack);
    } else if (entry.level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }
}

export function createLogger(service: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) =>
      emit({ level: "debug", message, service, ...meta }),

    info: (message: string, meta?: Record<string, unknown>) =>
      emit({ level: "info", message, service, ...meta }),

    warn: (message: string, meta?: Record<string, unknown>) =>
      emit({ level: "warn", message, service, ...meta }),

    error: (message: string, err?: unknown, meta?: Record<string, unknown>) => {
      const errMeta: Record<string, unknown> = {};
      if (err instanceof Error) {
        errMeta.error = err.message;
        errMeta.stack = err.stack;
        errMeta.errorName = err.name;
      } else if (err !== undefined) {
        errMeta.error = String(err);
      }
      emit({ level: "error", message, service, ...errMeta, ...meta });
    }
  };
}

/** Convenience logger for one-off use (no service tag) */
export const log = createLogger("app");
