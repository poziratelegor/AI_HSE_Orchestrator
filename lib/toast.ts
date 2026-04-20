/**
 * Lightweight event-based toast system.
 * No context provider needed — works from any component or module.
 *
 * Usage:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Документ загружен!");
 *   toast.error("Ошибка загрузки.");
 *   toast.info("Синхронизация...");
 */

export type ToastTone = "success" | "error" | "warning" | "info";

export interface ToastPayload {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

const EVENT_NAME = "studyflow:toast";

function emit(message: string, tone: ToastTone, durationMs = 4000) {
  if (typeof window === "undefined") return;
  const payload: ToastPayload = { id: crypto.randomUUID(), message, tone, durationMs };
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: payload }));
}

export const toast = {
  success: (message: string, durationMs?: number) => emit(message, "success", durationMs),
  error:   (message: string, durationMs?: number) => emit(message, "error", durationMs ?? 6000),
  warning: (message: string, durationMs?: number) => emit(message, "warning", durationMs),
  info:    (message: string, durationMs?: number) => emit(message, "info", durationMs)
};

export { EVENT_NAME as TOAST_EVENT };
