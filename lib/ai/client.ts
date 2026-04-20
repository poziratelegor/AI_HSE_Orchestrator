import OpenAI from "openai";

let _client: OpenAI | null = null;

/**
 * Возвращает OpenAI-совместимый клиент.
 *
 * Провайдер определяется через LLM_PROVIDER:
 *   "openai"           — стандартный OpenAI (по умолчанию)
 *   "anthropic-compat" — Anthropic через OpenAI-совместимый endpoint
 *   "custom"           — произвольный OpenAI-совместимый URL (LLM_BASE_URL)
 *
 * При смене провайдера логика retry, token-guard и все сервисы работают без изменений,
 * т.к. используют единый OpenAI SDK.
 *
 * ⚠️ Whisper (STT) всегда работает через OpenAI — для него нужен OPENAI_API_KEY
 *    независимо от LLM_PROVIDER.
 */
export function getOpenAIClient(): OpenAI {
  if (_client) return _client;

  const provider = process.env.LLM_PROVIDER ?? "openai";

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
    _client = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });
  } else if (provider === "anthropic-compat") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is missing for anthropic-compat provider");
    _client = new OpenAI({
      apiKey,
      baseURL: "https://api.anthropic.com/v1/",
      timeout: 60_000,
      maxRetries: 0,
    });
  } else if (provider === "custom") {
    const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
    const baseURL = process.env.LLM_BASE_URL;
    if (!apiKey) throw new Error("LLM_API_KEY (or OPENAI_API_KEY) is missing for custom provider");
    if (!baseURL) throw new Error("LLM_BASE_URL is missing for custom provider");
    _client = new OpenAI({ apiKey, baseURL, timeout: 60_000, maxRetries: 0 });
  } else {
    throw new Error(
      `Неизвестный LLM_PROVIDER: "${provider}". Допустимые: openai, anthropic-compat, custom`
    );
  }

  return _client;
}

/**
 * Отдельный клиент для Whisper (STT).
 * Всегда использует OpenAI, т.к. Whisper — только OpenAI.
 */
let _whisperClient: OpenAI | null = null;

export function getWhisperClient(): OpenAI {
  if (_whisperClient) return _whisperClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for Whisper STT");
  _whisperClient = new OpenAI({ apiKey, timeout: 60_000, maxRetries: 0 });
  return _whisperClient;
}

/** The default model used for completions. Override via OPENAI_MODEL env var. */
export const DEFAULT_MODEL: string = (() => {
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
  const provider = process.env.LLM_PROVIDER ?? "openai";
  if (provider === "anthropic-compat") return "claude-haiku-4-5-20251001";
  return "gpt-4o-mini";
})();
