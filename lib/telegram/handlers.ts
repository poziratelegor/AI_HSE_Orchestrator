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
import { processDocument } from "@/lib/services/documents/ingestion";
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
  LINK_EXPIRED: "⚠️ Срок действия кода истёк (код живёт 15 минут). Сгенерируйте новый в профиле.",
  PROCESSING: "⏳ Обрабатываю запрос...",
  VOICE_TOO_BIG: "⚠️ Аудио слишком большое (лимит 25 МБ). Попробуйте записать короче.",
  VOICE_DOWNLOAD_FAIL: "⚠️ Не удалось скачать аудио. Попробуйте ещё раз.",
  TRANSCRIBE_FAIL: "⚠️ Не удалось распознать аудио. Попробуйте написать текстом.",
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

  if (from) void upsertTelegramUser(from);

  // ─── /start (с возможным deep-link link_<CODE>) ──────────────────────────
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

  // ─── Фото — пока не поддерживаем ─────────────────────────────────────────
  if (message.photo && message.photo.length > 0 && !message.caption) {
    await sendMessage({ chatId, text: MSG.PHOTO_NOT_SUPPORTED });
    return { ok: true };
  }

  // ─── Документ → ingestion в RAG ──────────────────────────────────────────
  if (message.document) {
    const userId = from ? await getLinkedUserId(from.id) : undefined;
    if (!userId) {
      await sendMessage({ chatId, text: MSG.DOC_NEED_LINK });
      return { ok: true };
    }
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
      await runOrchestrate(caption, chatId, message.message_id, from?.id);
    }
    return { ok: true };
  }

  // ─── Определяем входной текст из voice / audio / video_note / text / caption
  let inputText: string | null = null;
  let transcribedFromAudio = false;

  // 1) Голосовое (PTT)
  if (message.voice) {
    if (message.voice.file_size && message.voice.file_size > MAX_AUDIO_SIZE) {
      await sendMessage({ chatId, text: MSG.VOICE_TOO_BIG });
      return { ok: true };
    }
    await sendChatAction(chatId, "typing");
    const t = await transcribeFile(message.voice.file_id, message.voice.mime_type || "audio/ogg", "voice.ogg");
    if (!t) {
      await sendMessage({ chatId, text: MSG.TRANSCRIBE_FAIL });
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
      await sendMessage({ chatId, text: MSG.TRANSCRIBE_FAIL });
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
      await sendMessage({ chatId, text: MSG.TRANSCRIBE_FAIL });
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

  // Если транскрибировали — покажем что распозналось
  if (transcribedFromAudio) {
    await sendMessage({
      chatId,
      text: `🎤 _Распознано:_ ${escapeMd(inputText)}`,
      parseMode: "Markdown",
    });
  }

  await runOrchestrate(inputText.trim(), chatId, message.message_id, from?.id);
  return { ok: true };
}

// ─── Orchestrate + send formatted reply ──────────────────────────────────────

async function runOrchestrate(
  text: string,
  chatId: number | string,
  replyToMessageId: number,
  fromTelegramId?: number
): Promise<void> {
  await sendChatAction(chatId, "typing");

  try {
    const userId = fromTelegramId ? await getLinkedUserId(fromTelegramId) : undefined;

    const result = await orchestrate({
      text,
      channel: "telegram",
      userId,
    });

    const formatted = formatOrchestrateResultForTelegram(result);

    // Если задачи извлечены, но аккаунт не привязан — добавим подсказку
    const needsLinkHint =
      formatted.workflow === "task_extractor" &&
      !userId &&
      !formatted.chunks[0].includes("Сохранено в трекер");

    if (needsLinkHint) {
      formatted.chunks[formatted.chunks.length - 1] +=
        "\n\n_💡 Привяжите аккаунт командой /link — задачи будут сохраняться автоматически и я пришлю напоминания о дедлайнах._";
    }

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
