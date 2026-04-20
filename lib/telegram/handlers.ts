/**
 * Telegram update handler.
 *
 * Принимает raw update от Telegram webhook → определяет тип (текст / голос / документ)
 * → upsert telegram_users → вызывает orchestrate() → отправляет ответ.
 *
 * Инвариант: никогда не бросает наружу — логирует и отправляет пользователю сообщение об ошибке.
 */

import { orchestrate } from "@/lib/orchestrator/router";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  sendMessage,
  sendChatAction,
  getTelegramFilePath,
  downloadTelegramFile
} from "@/lib/telegram/bot";

// ─── Telegram types (минимальное подмножество) ───────────────────────────────

type TelegramUser = {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

type TelegramVoice = {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
};

type TelegramDocument = {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  voice?: TelegramVoice;
  document?: TelegramDocument;
  caption?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_VOICE_SIZE = 20 * 1024 * 1024; // 20 МБ — лимит Whisper
const WHISPER_TIMEOUT_MS = 60_000;

const MSG = {
  WELCOME: [
    "👋 Привет! Я *StudyFlow AI* — ваш академический ассистент.",
    "",
    "Что я умею:",
    "• Генерировать официальные письма",
    "• Извлекать задачи и дедлайны",
    "• Составлять планы подготовки",
    "• Объяснять сложные темы",
    "• Создавать шпаргалки и квизы",
    "• Отвечать по загруженным документам",
    "",
    "Просто напишите задачу в свободной форме или отправьте голосовое сообщение 🎤"
  ].join("\n"),
  PROCESSING: "⏳ Обрабатываю запрос...",
  VOICE_TOO_BIG: "⚠️ Голосовое сообщение слишком большое (лимит 20 МБ). Попробуйте записать короче.",
  VOICE_DOWNLOAD_FAIL: "⚠️ Не удалось скачать голосовое сообщение. Попробуйте ещё раз.",
  TRANSCRIBE_FAIL: "⚠️ Не удалось распознать голосовое сообщение. Попробуйте написать текстом.",
  GENERAL_ERROR: "⚠️ Произошла ошибка при обработке запроса. Попробуйте позже.",
  EMPTY_TEXT: "Напишите задачу текстом или отправьте голосовое сообщение. Для справки — /start."
};

// ─── Upsert telegram user ────────────────────────────────────────────────────

async function upsertTelegramUser(from: TelegramUser): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();

    await supabase.from("telegram_users").upsert(
      {
        telegram_user_id: String(from.id),
        username: from.username ?? null,
        first_name: from.first_name,
        last_name: from.last_name ?? null,
        last_active_at: new Date().toISOString()
      },
      { onConflict: "telegram_user_id" }
    );
  } catch (err) {
    console.error("[telegram/upsertUser] Error:", err instanceof Error ? err.message : err);
  }
}

// ─── Lookup linked Supabase userId ───────────────────────────────────────────

async function getLinkedUserId(telegramUserId: number): Promise<string | undefined> {
  try {
    const supabase = getSupabaseServerClient();

    const { data } = await supabase
      .from("telegram_users")
      .select("user_id")
      .eq("telegram_user_id", String(telegramUserId))
      .single();

    return (data as { user_id?: string } | null)?.user_id ?? undefined;
  } catch {
    return undefined;
  }
}

// ─── Transcribe voice ────────────────────────────────────────────────────────

async function transcribeVoice(voice: TelegramVoice): Promise<string | null> {
  // 1. Получить file_path
  const filePath = await getTelegramFilePath(voice.file_id);
  if (!filePath) return null;

  // 2. Скачать файл
  const blob = await downloadTelegramFile(filePath);
  if (!blob) return null;

  // 3. Whisper
  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

  try {
    const audioFile = new File([blob], "voice.ogg", {
      type: voice.mime_type || "audio/ogg"
    });

    const result = await openai.audio.transcriptions.create(
      { file: audioFile, model: "whisper-1", language: "ru" },
      { signal: controller.signal }
    );

    return result.text || null;
  } catch (err) {
    console.error("[telegram/transcribeVoice] Error:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Format result ───────────────────────────────────────────────────────────

function formatResult(result: unknown): string {
  if (!result || typeof result !== "object") return String(result ?? "");

  const obj = result as Record<string, unknown>;

  // orchestrate возвращает { ok, intent, result: { ok, workflow, data } }
  // или при clarification: { ok, workflow: "route_recommender", summary, data: { question } }
  // или при recommend zone: { ok, lowConfidence, suggestion, result: { ... } }
  const inner = (obj.result ?? obj) as Record<string, unknown>;
  const data = (inner.data ?? inner) as Record<string, unknown>;

  // Suggestion для recommend zone (недостаточная уверенность)
  if (typeof obj.suggestion === "string") return obj.suggestion;

  // Пытаемся извлечь читаемые поля из data
  if (typeof data.body === "string") return data.body;
  if (typeof data.summary === "string") return data.summary;
  if (typeof data.explanation === "string") return data.explanation;
  if (typeof data.answer === "string") return data.answer;
  if (typeof data.question === "string") return `❓ ${data.question}`;

  // fallback — строковое представление
  if (typeof inner.message === "string") return inner.message;
  if (typeof obj.message === "string") return obj.message;

  // JSON fallback
  try {
    const json = JSON.stringify(data, null, 2);
    // Telegram ограничивает сообщение 4096 символами
    return json.length > 3800 ? json.slice(0, 3800) + "\n\n…(обрезано)" : json;
  } catch {
    return "Результат получен, но его не удалось отформатировать.";
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: unknown): Promise<{ ok: boolean }> {
  // Парсим update
  if (!update || typeof update !== "object") {
    return { ok: true };
  }

  const tgUpdate = update as TelegramUpdate;
  const message = tgUpdate.message;

  if (!message) {
    // callback_query, edited_message, etc. — пока не обрабатываем
    return { ok: true };
  }

  const chatId = message.chat.id;
  const from = message.from;

  // Upsert user
  if (from) {
    void upsertTelegramUser(from);
  }

  // ─── /start command ──────────────────────────────────────────────────────
  if (message.text?.startsWith("/start")) {
    await sendMessage({ chatId, text: MSG.WELCOME });
    return { ok: true };
  }

  // ─── /help command ───────────────────────────────────────────────────────
  if (message.text?.startsWith("/help")) {
    await sendMessage({ chatId, text: MSG.WELCOME });
    return { ok: true };
  }

  // ─── Determine input text ────────────────────────────────────────────────
  let inputText: string | null = null;

  // Голосовое сообщение → транскрибация
  if (message.voice) {
    if (message.voice.file_size && message.voice.file_size > MAX_VOICE_SIZE) {
      await sendMessage({ chatId, text: MSG.VOICE_TOO_BIG });
      return { ok: true };
    }

    await sendChatAction(chatId, "typing");

    const transcript = await transcribeVoice(message.voice);

    if (!transcript) {
      await sendMessage({ chatId, text: MSG.TRANSCRIBE_FAIL });
      return { ok: true };
    }

    // Показать распознанный текст
    await sendMessage({
      chatId,
      text: `🎤 _Распознано:_ ${transcript}`,
      parseMode: "Markdown"
    });

    inputText = transcript;
  }

  // Текстовое сообщение
  if (!inputText && message.text) {
    inputText = message.text;
  }

  // Caption документа
  if (!inputText && message.caption) {
    inputText = message.caption;
  }

  // Нет входного текста
  if (!inputText || !inputText.trim()) {
    await sendMessage({ chatId, text: MSG.EMPTY_TEXT });
    return { ok: true };
  }

  // ─── Orchestrate ─────────────────────────────────────────────────────────
  await sendChatAction(chatId, "typing");

  try {
    const userId = from ? await getLinkedUserId(from.id) : undefined;

    const result = await orchestrate({
      text: inputText.trim(),
      channel: "telegram",
      userId
    });

    const responseText = formatResult(result);

    await sendMessage({
      chatId,
      text: responseText || "Готово, но результат пуст.",
      replyToMessageId: message.message_id
    });
  } catch (err) {
    console.error("[telegram/handler] Orchestrate error:", err instanceof Error ? err.message : err);
    await sendMessage({ chatId, text: MSG.GENERAL_ERROR });
  }

  return { ok: true };
}
