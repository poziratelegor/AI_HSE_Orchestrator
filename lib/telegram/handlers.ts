/**
 * Telegram update handler.
 *
 * Принимает raw update от Telegram webhook → определяет тип сообщения
 * (текст / голос / аудио / видео-кружок / документ) → upsert telegram_users
 * → опционально привязывает аккаунт через /start link_<code>
 * → транскрибирует / сохраняет файл при необходимости
 * → вызывает orchestrate() и форматирует ответ.
 *
 * Инвариант: НИКОГДА не бросает наружу — логирует и шлёт пользователю
 * сообщение об ошибке. Webhook всегда отвечает 200 OK.
 */

import { orchestrate } from "@/lib/orchestrator/router";
import { getOpenAIClient } from "@/lib/ai/client";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cacheSetIfAbsent } from "@/lib/cache/redis";
import { processDocument } from "@/lib/services/documents/ingestion";
import { checkRateLimit } from "@/lib/api/rate-limit";
import {
  sendMessage,
  sendMessageChunks,
  sendChatAction,
  getTelegramFilePath,
  downloadTelegramFile,
} from "@/lib/telegram/bot";
import { formatOrchestrateResultForTelegram } from "@/lib/telegram/format";
import { consumeLinkCode, parseStartLinkPayload } from "@/lib/telegram/link";

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

type TelegramAudio = {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramVideoNote = {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  file_size?: number;
};

type TelegramDocument = {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};

type TelegramPhotoSize = {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
};

type TelegramMessage = {
  message_id: number;
  from?: TelegramUser;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  video_note?: TelegramVideoNote;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  caption?: string;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 МБ — лимит Whisper API
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 МБ — наш лимит на upload
const WHISPER_TIMEOUT_MS = 60_000;
const MAX_TEXT_INPUT = 15_000; // символов — защита от DoS токенов LLM
const DOC_DAILY_LIMIT = 10;
const DOC_MONTHLY_BYTES_LIMIT = 500 * 1024 * 1024; // 500 MB

// Rate-limit: одинаковый per chatId для привязанных и непривязанных.
// 30 запросов/час на chat_id.
const TG_RATE_LIMIT = {
  limit: 30,
  windowSeconds: 60 * 60,
  action: "telegram_chat",
  failOpen: false,
} as const;
// Голосовые/аудио/видео-кружки — дорогие, отдельный лимит 5/час.
const TG_VOICE_RATE_LIMIT = {
  limit: 5,
  windowSeconds: 60 * 60,
  action: "telegram_voice",
  failOpen: false,
} as const;

const SUPPORTED_DOC_MIME = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/octet-stream", // Telegram иногда так маркирует .txt/.md
]);

const MSG = {
  WELCOME: [
    "👋 Привет! Я *StudyFlow AI* — ваш академический ассистент.",
    "",
    "*Что я умею:*",
    "• ✉️ Генерировать официальные письма",
    "• 📝 Извлекать задачи и дедлайны (с напоминаниями)",
    "• 📅 Составлять планы подготовки",
    "• 💡 Объяснять сложные темы",
    "• 📋 Создавать шпаргалки и квизы",
    "• 📚 Отвечать по загруженным документам",
    "",
    "*Как пользоваться:*",
    "• Просто напишите задачу в свободной форме",
    "• Отправьте 🎤 голосовое сообщение, аудио или видео-кружок",
    "• Пришлите 📎 PDF/TXT/MD — я загружу его в вашу базу знаний",
    "",
    "*Команды:*",
    "/link — привязать ваш аккаунт StudyFlow к этому Telegram",
    "/help — эта справка",
  ].join("\n"),
  LINK_HINT: [
    "🔗 *Привязка аккаунта Telegram*",
    "",
    "Чтобы я сохранял ваши задачи в трекер и присылал напоминания о дедлайнах,",
    "мне нужно связать ваш Telegram с аккаунтом StudyFlow AI:",
    "",
    "1. Откройте сайт → раздел *Профиль*",
    "2. Нажмите кнопку *«Привязать Telegram»*",
    "3. Перейдите по полученной ссылке",
    "",
    "После этого все задачи и письма из чата автоматически попадут в ваш дашборд.",
  ].join("\n"),
  LINK_OK: "✅ Аккаунт успешно привязан! Теперь я сохраняю ваши задачи и шлю напоминания о дедлайнах.",
  LINK_NOT_FOUND: "⚠️ Код привязки не найден или уже использован. Сгенерируйте новый в /dashboard/profile.",
  LINK_EXPIRED: "⚠️ Срок действия кода истёк (код живёт 5 минут). Сгенерируйте новый в профиле.",
  NEED_LINK: [
    "🔒 *Доступ только для зарегистрированных пользователей.*",
    "",
    "Чтобы пользоваться ассистентом, привяжите аккаунт StudyFlow AI:",
    "1. Зарегистрируйтесь на сайте (если ещё не сделали)",
    "2. Откройте *Профиль* → кнопка *«Привязать Telegram»*",
    "3. Перейдите по полученной ссылке",
    "",
    "Команда /link — подробности.",
  ].join("\n"),
  RATE_LIMITED: "⚠️ Слишком много сообщений. Лимит: 30 запросов в час. Попробуйте позже.",
  RATE_LIMITED_HEAVY: "⚠️ Слишком много голосовых за час. Лимит: 5 голосовых/аудио в час.",
  TEMP_UNAVAILABLE: "⚠️ Сервис временно недоступен. Попробуйте позже.",
  TEXT_TOO_LONG: `⚠️ Слишком длинное сообщение (лимит ${15_000} символов). Разбейте на несколько частей.`,
  PROCESSING: "⏳ Обрабатываю запрос...",
  VOICE_TOO_BIG: "⚠️ Аудио слишком большое (лимит 25 МБ). Попробуйте записать короче.",
  VOICE_DOWNLOAD_FAIL: "⚠️ Не удалось скачать аудио. Попробуйте ещё раз.",
  TRANSCRIBE_FAIL: "⚠️ Не удалось распознать аудио. Попробуйте написать текстом.",
  FORWARDED_MEDIA_FAIL:
    "⚠️ Не удалось обработать пересланное аудио/голосовое (invalid file_id). Перешлите файл ещё раз или отправьте напрямую.",
  GENERAL_ERROR: "⚠️ Произошла ошибка при обработке запроса. Попробуйте позже.",
  EMPTY_TEXT: "Напишите задачу текстом, отправьте голосовое сообщение или прикрепите файл. Для справки — /start.",
  PHOTO_NOT_SUPPORTED:
    "📷 Я пока не умею читать содержимое фотографий. Если на снимке текст — пришлите его как PDF/TXT, я его проиндексирую.",
  DOC_NEED_LINK: "📎 Чтобы загружать документы в вашу базу знаний, привяжите аккаунт командой /link.",
  DOC_TOO_BIG: "⚠️ Файл слишком большой (лимит 20 МБ).",
  DOC_UNSUPPORTED:
    "⚠️ Пока поддерживаются только PDF, TXT и MD. Остальные форматы — через раздел «Документы» на сайте.",
  DOC_INGESTING: "📥 Загружаю документ в вашу базу знаний — обычно занимает 10–60 сек...",
  DOC_DONE: (name: string) =>
    `✅ Документ «${name}» добавлен. Теперь можно задавать вопросы по нему — например: «что говорилось про X в моих материалах?»`,
  DOC_FAIL: "⚠️ Не удалось обработать документ. Попробуйте загрузить через сайт.",
  DOC_DAILY_QUOTA:
    "⚠️ Достигнут дневной лимит документов (10/день). Попробуйте снова завтра.",
  DOC_MONTHLY_QUOTA:
    "⚠️ Достигнут месячный лимит объёма документов (500 MB/месяц).",
};

async function ensureDocumentQuota(userId: string, incomingBytes: number): Promise<{
  ok: boolean;
  reason?: "daily_limit" | "monthly_limit";
}> {
  const supabase = getSupabaseServerClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const { count, error: countErr } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayStart.toISOString());
  if (!countErr && (count ?? 0) >= DOC_DAILY_LIMIT) {
    return { ok: false, reason: "daily_limit" };
  }

  const { data, error: monthErr } = await supabase
    .from("documents")
    .select("file_size_bytes")
    .eq("user_id", userId)
    .gte("created_at", monthStart.toISOString());
  if (!monthErr) {
    const currentBytes = (data ?? []).reduce((sum, row) => {
      const bytes = (row as { file_size_bytes?: number | null }).file_size_bytes ?? 0;
      return sum + bytes;
    }, 0);
    if (currentBytes + Math.max(0, incomingBytes) > DOC_MONTHLY_BYTES_LIMIT) {
      return { ok: false, reason: "monthly_limit" };
    }
  }

  return { ok: true };
}

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
        last_active_at: new Date().toISOString(),
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

// ─── Transcribe (voice / audio / video_note) ─────────────────────────────────

async function transcribeFile(
  fileId: string,
  fallbackMime: string,
  fallbackName: string
): Promise<string | null> {
  const filePath = await getTelegramFilePath(fileId);
  if (!filePath) return null;

  const blob = await downloadTelegramFile(filePath);
  if (!blob) return null;

  const openai = getOpenAIClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

  try {
    const audioFile = new File([blob], fallbackName, {
      type: blob.type || fallbackMime,
    });

    const result = await openai.audio.transcriptions.create(
      { file: audioFile, model: "whisper-1", language: "ru" },
      { signal: controller.signal }
    );

    return result.text || null;
  } catch (err) {
    console.error("[telegram/transcribe] Error:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Document ingestion ──────────────────────────────────────────────────────

async function ingestDocument(opts: {
  doc: TelegramDocument;
  userId: string;
  chatId: number | string;
}): Promise<{ ok: boolean; title: string }> {
  const supabase = getSupabaseServerClient();
  const title = opts.doc.file_name || "Документ из Telegram";

  // 1. Скачиваем файл
  const filePath = await getTelegramFilePath(opts.doc.file_id);
  if (!filePath) return { ok: false, title };
  const blob = await downloadTelegramFile(filePath);
  if (!blob) return { ok: false, title };

  // 2. Создаём запись documents (status: pending)
  const documentId = crypto.randomUUID();
  const mimeType = opts.doc.mime_type || "application/octet-stream";
  const ext = title.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
  const storagePath = `${opts.userId}/${documentId}${ext}`;

  // 3. Заливаем в Supabase Storage
  const arrayBuf = await blob.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, arrayBuf, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    console.error("[telegram/ingestDocument] storage upload:", uploadErr.message);
    return { ok: false, title };
  }

  const { error: insertErr } = await supabase.from("documents").insert({
    id: documentId,
    user_id: opts.userId,
    title,
    file_path: storagePath,
    mime_type: mimeType,
    file_size_bytes: opts.doc.file_size ?? blob.size,
    processing_status: "pending",
    source_type: "telegram",
  });

  if (insertErr) {
    console.error("[telegram/ingestDocument] insert:", insertErr.message);
    return { ok: false, title };
  }

  // 4. Запускаем обработку (chunk → embed → pgvector)
  try {
    await processDocument({ documentId, storagePath, mimeType });
    return { ok: true, title };
  } catch (err) {
    console.error("[telegram/ingestDocument] processDocument:", err instanceof Error ? err.message : err);
    return { ok: false, title };
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function handleTelegramUpdate(update: unknown): Promise<{ ok: boolean }> {
  if (!update || typeof update !== "object") return { ok: true };

  const tgUpdate = update as TelegramUpdate;
  const message = tgUpdate.message;
  if (!message) return { ok: true }; // callback_query, edited_message — позже

  const chatId = message.chat.id;
  const from = message.from;

  // ─── Dedup webhook retries (best-effort) ──────────────────────────────────
  const updateDedup = await cacheSetIfAbsent(`tg:update:${tgUpdate.update_id}`, "1", 60 * 60 * 24);
  if (updateDedup === false) return { ok: true };
  const messageDedup = await cacheSetIfAbsent(`tg:message:${chatId}:${message.message_id}`, "1", 60 * 60 * 24);
  if (messageDedup === false) return { ok: true };

  // ─── Rate-limit по chat_id (до любой дорогой работы) ─────────────────────
  const rlKey = `tg:${chatId}`;
  const rl = await checkRateLimit(rlKey, TG_RATE_LIMIT);
  if (!rl.allowed) {
    await sendMessage({ chatId, text: rl.response.status === 429 ? MSG.RATE_LIMITED : MSG.TEMP_UNAVAILABLE });
    return { ok: true };
  }

  if (from) void upsertTelegramUser(from);

  // ─── PUBLIC команды (доступны без привязки) ──────────────────────────────
  // /start [link_<CODE>], /help, /link
  if (message.text?.startsWith("/start")) {
    const code = parseStartLinkPayload(message.text);
    if (code && from) {
      const result = await consumeLinkCode(code, from.id, {
        username: from.username,
        first_name: from.first_name,
        last_name: from.last_name,
      });
      if (result.ok) {
        await sendMessage({ chatId, text: MSG.LINK_OK });
        return { ok: true };
      }
      const reply =
        result.reason === "expired" ? MSG.LINK_EXPIRED : MSG.LINK_NOT_FOUND;
      await sendMessage({ chatId, text: reply });
      return { ok: true };
    }
    await sendMessage({ chatId, text: MSG.WELCOME, parseMode: "Markdown" });
    return { ok: true };
  }

  if (message.text?.startsWith("/help")) {
    await sendMessage({ chatId, text: MSG.WELCOME, parseMode: "Markdown" });
    return { ok: true };
  }

  if (message.text?.startsWith("/link")) {
    await sendMessage({ chatId, text: MSG.LINK_HINT, parseMode: "Markdown" });
    return { ok: true };
  }

  // ─── AUTH GATE: всё остальное — только для привязанных ───────────────────
  // Любой функционал (orchestrate/voice/document) стоит денег (OpenAI) и
  // имеет смысл только для известного userId. Без привязки — отказ.
  const userId = from ? await getLinkedUserId(from.id) : undefined;
  if (!userId) {
    await sendMessage({ chatId, text: MSG.NEED_LINK, parseMode: "Markdown" });
    return { ok: true };
  }

  // ─── Фото — пока не поддерживаем ─────────────────────────────────────────
  if (message.photo && message.photo.length > 0 && !message.caption) {
    await sendMessage({ chatId, text: MSG.PHOTO_NOT_SUPPORTED });
    return { ok: true };
  }

  // ─── Документ → ingestion в RAG ──────────────────────────────────────────
  if (message.document) {
    if (message.document.file_size && message.document.file_size > MAX_DOCUMENT_SIZE) {
      await sendMessage({ chatId, text: MSG.DOC_TOO_BIG });
      return { ok: true };
    }
    const mime = (message.document.mime_type || "").toLowerCase();
    const fname = (message.document.file_name || "").toLowerCase();
    const isText = mime === "text/plain" || mime === "text/markdown" || fname.endsWith(".txt") || fname.endsWith(".md");
    const isPdf = mime === "application/pdf" || fname.endsWith(".pdf");
    if (!SUPPORTED_DOC_MIME.has(mime) && !isText && !isPdf) {
      await sendMessage({ chatId, text: MSG.DOC_UNSUPPORTED });
      return { ok: true };
    }

    const quota = await ensureDocumentQuota(userId, message.document.file_size ?? 0);
    if (!quota.ok) {
      await sendMessage({
        chatId,
        text: quota.reason === "daily_limit" ? MSG.DOC_DAILY_QUOTA : MSG.DOC_MONTHLY_QUOTA,
      });
      return { ok: true };
    }

    await sendChatAction(chatId, "upload_document");
    await sendMessage({ chatId, text: MSG.DOC_INGESTING });

    // Если у документа есть caption — будем дополнительно прогонять как orchestrate
    const caption = message.caption?.trim() ?? "";

    const ingest = await ingestDocument({ doc: message.document, userId, chatId });
    if (ingest.ok) {
      await sendMessage({ chatId, text: MSG.DOC_DONE(ingest.title) });
    } else {
      await sendMessage({ chatId, text: MSG.DOC_FAIL });
    }

    // Если caption — запускаем orchestrate с ним (например, "найди тут про X")
    if (caption) {
      if (caption.length > MAX_TEXT_INPUT) {
        await sendMessage({ chatId, text: MSG.TEXT_TOO_LONG });
      } else {
        await runOrchestrate(caption, chatId, message.message_id, userId);
      }
    }
    return { ok: true };
  }

  // ─── Определяем входной текст из voice / audio / video_note / text / caption
  let inputText: string | null = null;
  let transcribedFromAudio = false;

  // Аудио-ветки — дорогие, требуем heavy rate-limit.
  const hasAudio = !!(message.voice || message.audio || message.video_note);
  if (hasAudio) {
    const rlHeavy = await checkRateLimit(rlKey, TG_VOICE_RATE_LIMIT);
    if (!rlHeavy.allowed) {
      await sendMessage({
        chatId,
        text: rlHeavy.response.status === 429 ? MSG.RATE_LIMITED_HEAVY : MSG.TEMP_UNAVAILABLE,
      });
      return { ok: true };
    }
  }

  // 1) Голосовое (PTT)
  if (message.voice) {
    if (message.voice.file_size && message.voice.file_size > MAX_AUDIO_SIZE) {
      await sendMessage({ chatId, text: MSG.VOICE_TOO_BIG });
      return { ok: true };
    }
    await sendChatAction(chatId, "typing");
    const t = await transcribeFile(message.voice.file_id, message.voice.mime_type || "audio/ogg", "voice.ogg");
    if (!t) {
      await sendMessage({ chatId, text: isForwardedMedia(message) ? MSG.FORWARDED_MEDIA_FAIL : MSG.TRANSCRIBE_FAIL });
      return { ok: true };
    }
    inputText = t;
    transcribedFromAudio = true;
  }

  // 2) Аудиофайл (mp3/m4a/...)
  if (!inputText && message.audio) {
    if (message.audio.file_size && message.audio.file_size > MAX_AUDIO_SIZE) {
      await sendMessage({ chatId, text: MSG.VOICE_TOO_BIG });
      return { ok: true };
    }
    await sendChatAction(chatId, "typing");
    const t = await transcribeFile(
      message.audio.file_id,
      message.audio.mime_type || "audio/mpeg",
      message.audio.file_name || "audio.mp3"
    );
    if (!t) {
      await sendMessage({ chatId, text: isForwardedMedia(message) ? MSG.FORWARDED_MEDIA_FAIL : MSG.TRANSCRIBE_FAIL });
      return { ok: true };
    }
    inputText = t;
    transcribedFromAudio = true;
  }

  // 3) Видео-кружок (с аудиодорожкой)
  if (!inputText && message.video_note) {
    if (message.video_note.file_size && message.video_note.file_size > MAX_AUDIO_SIZE) {
      await sendMessage({ chatId, text: MSG.VOICE_TOO_BIG });
      return { ok: true };
    }
    await sendChatAction(chatId, "typing");
    const t = await transcribeFile(message.video_note.file_id, "video/mp4", "video_note.mp4");
    if (!t) {
      await sendMessage({ chatId, text: isForwardedMedia(message) ? MSG.FORWARDED_MEDIA_FAIL : MSG.TRANSCRIBE_FAIL });
      return { ok: true };
    }
    inputText = t;
    transcribedFromAudio = true;
  }

  // 4) Текстовое сообщение / 5) caption фото
  if (!inputText && message.text) inputText = message.text;
  if (!inputText && message.caption) inputText = message.caption;

  if (!inputText || !inputText.trim()) {
    await sendMessage({ chatId, text: MSG.EMPTY_TEXT });
    return { ok: true };
  }

  // MAX_LENGTH — защита от DoS токенов
  if (inputText.length > MAX_TEXT_INPUT) {
    await sendMessage({ chatId, text: MSG.TEXT_TOO_LONG });
    return { ok: true };
  }

  // Если транскрибировали — покажем что распозналось
  if (transcribedFromAudio) {
    await sendMessage({
      chatId,
      text: `🎤 _Распознано:_ ${escapeMd(inputText)}`,
      parseMode: "Markdown",
    });
  }

  await runOrchestrate(inputText.trim(), chatId, message.message_id, userId);
  return { ok: true };
}

// ─── Orchestrate + send formatted reply ──────────────────────────────────────

async function runOrchestrate(
  text: string,
  chatId: number | string,
  replyToMessageId: number,
  userId: string
): Promise<void> {
  await sendChatAction(chatId, "typing");

  try {
    const result = await orchestrate({
      text,
      channel: "telegram",
      userId,
    });

    const formatted = formatOrchestrateResultForTelegram(result);

    await sendMessageChunks(chatId, formatted.chunks, {
      parseMode: "Markdown",
      replyToMessageId,
    });
  } catch (err) {
    console.error("[telegram/handler] Orchestrate error:", err instanceof Error ? err.message : err);
    await sendMessage({ chatId, text: MSG.GENERAL_ERROR });
  }
}

// Минимальное экранирование для inline-кода (Markdown legacy)
function escapeMd(s: string): string {
  return s.replace(/([`*_\[])/g, "\\$1");
}

function isForwardedMedia(message: TelegramMessage): boolean {
  const m = message as TelegramMessage & Record<string, unknown>;
  return Boolean(m.forward_origin || m.forward_from || m.forward_date || m.forward_from_chat);
}
