/**
 * Telegram update handler.
 *
 * Принимает raw update от Telegram webhook → определяет тип сообщения
 * (текст / голос / аудио / видео-кружок / документ) → upsert telegram_users
 * → авторизует пользователя через FSM-поток (/start → email → ФИО)
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
  answerCallbackQuery,
  getTelegramFilePath,
  downloadTelegramFile,
} from "@/lib/telegram/bot";
import { formatOrchestrateResultForTelegram } from "@/lib/telegram/format";
import { getTelegramCtaLinks } from "@/lib/telegram/app-url";
import { trackEvent } from "@/lib/analytics/events";
import { ANALYTICS_EVENTS } from "@/lib/constants/analytics";
import { rankProfileMatches, type ProfileCandidate } from "@/lib/telegram/profile-match";

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
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
};

type TelegramFsmState = "idle" | "await_email" | "await_full_name" | "authorized";

type TelegramUserAuthState = {
  userId?: string;
  fsmState: TelegramFsmState;
  fsmContext: Record<string, unknown>;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 МБ — лимит Whisper API
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 МБ — наш лимит на upload
const WHISPER_TIMEOUT_MS = 60_000;
const MAX_TEXT_INPUT = 15_000; // символов — защита от DoS токенов LLM
const DOC_DAILY_LIMIT = 10;
const DOC_MONTHLY_BYTES_LIMIT = 500 * 1024 * 1024; // 500 MB
const AUTH_MATCH_THRESHOLD = 0.62;
const AUTH_FILTER_MAX_PATTERN_LENGTH = 64;
const AUTH_FILTER_MAX_TOKENS = 6;

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
    "*Быстрый старт (2 шага):*",
    "1. Нажмите *«🔐 Ввести email»* и отправьте email, с которым вы регистрировались в StudyFlow.",
    "2. После подтверждения просто напишите задачу в свободной форме.",
    "",
    "*Что я умею:*",
    "• ✉️ Генерировать официальные письма",
    "• 📝 Извлекать задачи и дедлайны (с напоминаниями)",
    "• 📅 Составлять планы подготовки",
    "• 💡 Объяснять сложные темы",
    "• 📋 Создавать шпаргалки и квизы",
    "• 📚 Отвечать по загруженным документам",
    "",
    "*Команды:*",
    "/start — вход по email и ФИО",
    "/help — эта справка",
  ].join("\n"),
  // Legacy тексты (оставляем для совместимости с main и безопасных merge/rebase).
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
  AUTH_START: [
    "🔐 *Авторизация в StudyFlow AI*",
    "",
    "Чтобы подключить этот Telegram к вашему аккаунту, пройдите короткую проверку профиля.",
    "Нажмите кнопку ниже и отправьте ФИО + группу (например: *Иванов Иван ПМИ-221*).",
  ].join("\n"),
  AUTH_ASK_PROFILE: "✍️ Отправьте *ФИО и группу* одним сообщением (например: Иванов Иван ПМИ-221).",
  AUTH_NOT_FOUND:
    "⚠️ Не удалось найти профиль. Проверьте ФИО/группу и попробуйте ещё раз. Для отмены — /start.",
  AUTH_AMBIGUOUS: (variants: string) =>
    `⚠️ Найдено несколько похожих профилей:\n${variants}\n\nУточните сообщение: добавьте полное ФИО и группу.`,
  AUTH_CONFIRM: (label: string) =>
    `Нашёл профиль:\n*${label}*\n\nПодтвердить привязку этого аккаунта?`,
  AUTH_CANCELLED: "Ок, отменил авторизацию. Чтобы начать заново — /start.",
  LINK_NOT_FOUND: "⚠️ Код привязки не найден или уже использован. Сгенерируйте новый в /dashboard/profile.",
  LINK_EXPIRED: "⚠️ Срок действия кода истёк (код живёт 5 минут). Сгенерируйте новый в профиле.",
  ASK_EMAIL: "📧 Введите email, который вы использовали при регистрации на сайте StudyFlow AI.",
  ASK_FULL_NAME:
    "🧾 Теперь введите ваше ФИО *точно как в профиле*.\nФормат: `Иванов Иван Иванович`.",
  AUTH_SUCCESS: "✅ Авторизация успешна! Теперь можете писать запрос в свободной форме.",
  AUTH_SIGNUP_NOT_FOUND: (signupUrl: string) => `⚠️ Запись не найдена. Сначала зарегистрируйтесь на сайте: ${signupUrl}`,
  AUTH_RETRY: "⚠️ Неверный формат ввода. Попробуйте ещё раз.",
  NEED_LINK: [
    "🔒 *Доступ только для зарегистрированных пользователей.*",
    "",
    "*Быстрый старт (2 шага):*",
    "1. Нажмите *«🔐 Ввести email»* ниже и отправьте email от аккаунта StudyFlow.",
    "2. Если аккаунта ещё нет — зарегистрируйтесь по ссылке *«Зарегистрироваться»*.",
    "",
    "После этого можно писать задачи, вопросы и загружать документы.",
  ].join("\n"),
  ACCESS_REQUIRED: [
    "🔒 *Доступ только для зарегистрированных пользователей.*",
    "",
    "*Быстрый старт (2 шага):*",
    "1. Нажмите *«🔐 Ввести email»* ниже и отправьте email от аккаунта StudyFlow.",
    "2. Если аккаунта ещё нет — зарегистрируйтесь по ссылке *«Зарегистрироваться»*.",
    "",
    "После этого можно писать задачи, вопросы и загружать документы.",
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
  DOC_NEED_LINK: "📎 Чтобы загружать документы в вашу базу знаний, сначала нажмите «🔐 Ввести email» и отправьте ваш email StudyFlow.",
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

  AUTH_EMAIL_PROMPT: [
    "🔐 *Вход в StudyFlow AI*",
    "",
    "Укажите ваш email, который использовали при регистрации на сайте.",
  ].join("\n"),
  AUTH_EMAIL_INVALID: "⚠️ Неверный формат email. Попробуйте ещё раз.",
  AUTH_NAME_PROMPT: "Отлично. Теперь введите ФИО как в профиле StudyFlow.",
  AUTH_NAME_INVALID: "⚠️ Введите ФИО (минимум 5 символов).",
  AUTH_FLOW_SUCCESS: "✅ Авторизация выполнена. Доступ открыт — можно сразу задавать вопросы.",
  AUTH_FAILED: "⚠️ Не удалось подтвердить аккаунт по email/ФИО. Проверьте данные и попробуйте снова.",
};

function buildTelegramInlineKeyboard() {
  const links = getTelegramCtaLinks();
  return {
    inline_keyboard: [[{ text: "Зарегистрироваться", url: links.signupUrl }]],
  };
}

function normalizeComparableText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

function normalizePostgrestFilterValue(value: string): string {
  return value
    .replace(/[-–—]/g, " ")
    .replace(/[(),{}[\].:*"'\\%!?&|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, AUTH_FILTER_MAX_PATTERN_LENGTH);
}

function getSafeProfileSearchTokens(value: string): string[] {
  const normalized = normalizePostgrestFilterValue(value);
  if (!normalized) return [];

  return normalized
    .split(" ")
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("ru-RU"))
    .filter((token) => token.length >= 2)
    .slice(0, AUTH_FILTER_MAX_TOKENS);
}

function buildProfileOrFilter(tokens: string[]): string {
  return tokens
    .flatMap((token) => [`full_name.ilike.%${token}%`, `group_name.ilike.%${token}%`])
    .join(",");
}

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());
}

function buildTelegramActionKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "ℹ️ /help", callback_data: "help" },
        { text: "🔐 Ввести email", callback_data: "auth:start" },
      ],
      [
        { text: "❓ Задать вопрос", callback_data: "scenario:ask_question" },
        { text: "📎 Загрузить документ", callback_data: "scenario:upload_document" },
      ],
    ],
  };
}

function buildTelegramAuthStartKeyboard() {
  return {
    inline_keyboard: [[{ text: "🔐 Начать авторизацию", callback_data: "auth:start" }]],
  };
}

function withExplicitLinksFallback(text: string): string {
  const links = getTelegramCtaLinks();
  if (links.hasCanonicalUrl) return text;

  return [
    text,
    "",
    "Ссылки:",
    `• Регистрация: ${links.signupUrl}`,
  ].join("\n");
}

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

// ─── Lookup linked Supabase userId + FSM state ───────────────────────────────

async function getTelegramAuthState(telegramUserId: number): Promise<TelegramUserAuthState> {
  try {
    const supabase = getSupabaseServerClient();

    const { data } = await supabase
      .from("telegram_users")
      .select("user_id,fsm_state,fsm_context")
      .eq("telegram_user_id", String(telegramUserId))
      .single();

    const row = data as {
      user_id?: string | null;
      fsm_state?: string | null;
      fsm_context?: Record<string, unknown> | null;
    } | null;

    const rawState = row?.fsm_state ?? "idle";
    const fsmState: TelegramFsmState =
      rawState === "await_email" || rawState === "await_full_name" || rawState === "authorized"
        ? rawState
        : "idle";

    return {
      userId: row?.user_id ?? undefined,
      fsmState,
      fsmContext: row?.fsm_context ?? {},
    };
  } catch {
    return { fsmState: "idle", fsmContext: {} };
  }
}

async function updateTelegramAuthState(
  telegramUserId: number,
  patch: Partial<{ userId: string | null; fsmState: TelegramFsmState; fsmContext: Record<string, unknown> }>
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    const payload: Record<string, unknown> = {
      telegram_user_id: String(telegramUserId),
      last_active_at: new Date().toISOString(),
    };
    if (patch.userId !== undefined) payload.user_id = patch.userId;
    if (patch.fsmState !== undefined) payload.fsm_state = patch.fsmState;
    if (patch.fsmContext !== undefined) payload.fsm_context = patch.fsmContext;

    await supabase.from("telegram_users").upsert(payload, { onConflict: "telegram_user_id" });
  } catch (err) {
    console.error("[telegram/updateAuthState] Error:", err instanceof Error ? err.message : err);
  }
}

async function resetTelegramAuthStateToAwaitEmail(telegramUserId: number): Promise<void> {
  await updateTelegramAuthState(telegramUserId, {
    userId: null,
    fsmState: "await_email",
    fsmContext: {},
  });
}

async function setTelegramAuthAwaitFullName(telegramUserId: number, email: string): Promise<void> {
  await updateTelegramAuthState(telegramUserId, {
    userId: null,
    fsmState: "await_full_name",
    fsmContext: { email: email.trim() },
  });
}

async function setTelegramAuthAuthorized(telegramUserId: number, userId: string): Promise<void> {
  await updateTelegramAuthState(telegramUserId, {
    userId,
    fsmState: "authorized",
    fsmContext: {},
  });
}

async function authorizeByEmailAndFullName(opts: {
  telegramUserId: number;
  email: string;
  fullName: string;
}): Promise<{ ok: boolean; userId?: string }> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", opts.email)
      .limit(1)
      .maybeSingle();

    const row = data as { id: string; full_name?: string | null; email?: string | null } | null;
    if (!row?.id || !row.full_name) return { ok: false };

    const isMatch =
      normalizeComparableText(row.email ?? "") === normalizeComparableText(opts.email) &&
      normalizeComparableText(row.full_name) === normalizeComparableText(opts.fullName);
    if (!isMatch) return { ok: false };

    await setTelegramAuthAuthorized(opts.telegramUserId, row.id);
    return { ok: true, userId: row.id };
  } catch (err) {
    console.error("[telegram/authorizeByEmailAndFullName] Error:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

type AuthFlowState = "idle" | "await_profile" | "await_confirm";
type AuthContext = {
  query?: string;
  candidateUserId?: string;
  candidateLabel?: string;
};

async function getTelegramAuthRecord(telegramUserId: number): Promise<{
  userId?: string;
  state: AuthFlowState;
  context: AuthContext;
}> {
  try {
    const supabase = getSupabaseServerClient();
    const { data } = await supabase
      .from("telegram_users")
      .select("user_id, fsm_state, fsm_context")
      .eq("telegram_user_id", String(telegramUserId))
      .single();

    const row = (data as { user_id?: string; fsm_state?: string; fsm_context?: AuthContext } | null) ?? null;
    const state = row?.fsm_state === "await_profile" || row?.fsm_state === "await_confirm" ? row.fsm_state : "idle";
    return {
      userId: row?.user_id ?? undefined,
      state,
      context: row?.fsm_context ?? {},
    };
  } catch {
    return { state: "idle", context: {} };
  }
}

async function setTelegramAuthState(telegramUserId: number, state: AuthFlowState, context: AuthContext = {}): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    await supabase
      .from("telegram_users")
      .upsert(
        {
          telegram_user_id: String(telegramUserId),
          fsm_state: state,
          fsm_context: context,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "telegram_user_id" }
      );
  } catch (err) {
    console.error("[telegram/auth] set state error:", err instanceof Error ? err.message : err);
  }
}

async function findProfileMatches(query: string, from: TelegramUser): Promise<ReturnType<typeof rankProfileMatches>> {
  const supabase = getSupabaseServerClient();
  const safeTokens = getSafeProfileSearchTokens(query);
  if (safeTokens.length === 0) return [];

  const normalizedQuery = safeTokens.join(" ");
  const orFilter = buildProfileOrFilter(safeTokens);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, group_name, faculty, program, course_number")
    .or(orFilter)
    .limit(50);

  if (error) {
    console.error("[telegram/auth] profile lookup error:", error.message);
    return [];
  }

  const candidates = (data ?? []) as ProfileCandidate[];
  return rankProfileMatches(candidates, normalizedQuery, {
    firstName: from.first_name,
    lastName: from.last_name,
    username: from.username,
  }, AUTH_MATCH_THRESHOLD);
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
  const callback = tgUpdate.callback_query;
  if (callback) {
    await handleCallbackQuery(callback);
    return { ok: true };
  }

  const message = tgUpdate.message;
  if (!message) return { ok: true }; // edited_message и прочее — игнорируем

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
  const authRecord = from ? await getTelegramAuthRecord(from.id) : { state: "idle" as AuthFlowState, context: {} as AuthContext };

  // ─── PUBLIC команды (доступны без привязки) ──────────────────────────────
  // /start, /help, /link
  if (message.text?.startsWith("/start")) {
    if (authRecord.userId) {
      if (from) await setTelegramAuthState(from.id, "idle", {});
      await sendMessage({
        chatId,
        text: withExplicitLinksFallback(MSG.WELCOME),
        parseMode: "Markdown",
        replyMarkup: buildTelegramActionKeyboard(),
      });
      return { ok: true };
    }

    if (from) await setTelegramAuthState(from.id, "await_profile", {});
    await sendMessage({
      chatId,
      text: [withExplicitLinksFallback(MSG.WELCOME), "", MSG.AUTH_START, MSG.AUTH_ASK_PROFILE].join("\n"),
      parseMode: "Markdown",
      replyMarkup: buildTelegramAuthStartKeyboard(),
    });
    return { ok: true };
  }

  if (message.text?.startsWith("/help")) {
    await sendMessage({
      chatId,
      text: withExplicitLinksFallback(MSG.WELCOME),
      parseMode: "Markdown",
      replyMarkup: authRecord.userId ? buildTelegramActionKeyboard() : buildTelegramAuthStartKeyboard(),
    });
    return { ok: true };
  }

  // ─── AUTH GATE: всё остальное — только для известных пользователей ───────
  // Любой функционал (orchestrate/voice/document) стоит денег (OpenAI) и
  // имеет смысл только для известного userId. Иначе — отказ.
  const userId = authRecord.userId;
  if (!userId) {
    if (from && message.text && authRecord.state === "await_profile") {
      const safeTokens = getSafeProfileSearchTokens(message.text);
      if (safeTokens.length === 0) {
        await sendMessage({
          chatId,
          text: `${MSG.AUTH_RETRY}\n${MSG.AUTH_ASK_PROFILE}`,
          parseMode: "Markdown",
        });
        return { ok: true };
      }

      const matches = await findProfileMatches(message.text, from);
      if (matches.length === 1) {
        const [best] = matches;
        const label = [best.profile.full_name, best.profile.group_name].filter(Boolean).join(" — ");
        await setTelegramAuthState(from.id, "await_confirm", {
          query: message.text,
          candidateUserId: best.profile.id,
          candidateLabel: label,
        });
        await sendMessage({
          chatId,
          text: MSG.AUTH_CONFIRM(label || "безымянный профиль"),
          parseMode: "Markdown",
          replyMarkup: {
            inline_keyboard: [[
              { text: "✅ Да, это я", callback_data: `auth:confirm:${best.profile.id}` },
              { text: "❌ Нет", callback_data: "auth:cancel" },
            ]],
          },
        });
        return { ok: true };
      }

      if (matches.length > 1) {
        const variants = matches
          .slice(0, 3)
          .map((item, idx) => `${idx + 1}. ${item.profile.full_name ?? "Без ФИО"} — ${item.profile.group_name ?? "без группы"}`)
          .join("\n");
        await sendMessage({ chatId, text: MSG.AUTH_AMBIGUOUS(variants) });
        return { ok: true };
      }

      await sendMessage({ chatId, text: MSG.AUTH_NOT_FOUND });
      return { ok: true };
    }

    await sendMessage({
      chatId,
      text: withExplicitLinksFallback(MSG.ACCESS_REQUIRED),
      parseMode: "Markdown",
      replyMarkup: buildTelegramAuthStartKeyboard(),
    });
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

type CallbackPayload =
  | "help"
  | "scenario:ask_question"
  | "scenario:upload_document"
  | "auth:start"
  | "auth:cancel"
  | `auth:confirm:${string}`;

const ALLOWED_CALLBACK_PAYLOADS = new Set<CallbackPayload>([
  "help",
  "scenario:ask_question",
  "scenario:upload_document",
  "auth:start",
  "auth:cancel",
]);

function parseCallbackPayload(value: unknown): CallbackPayload | null {
  if (typeof value !== "string") return null;
  if (value.startsWith("auth:confirm:")) return value as CallbackPayload;
  return ALLOWED_CALLBACK_PAYLOADS.has(value as CallbackPayload) ? (value as CallbackPayload) : null;
}

export const __telegramHandlerTestables = {
  buildProfileOrFilter,
  getSafeProfileSearchTokens,
  normalizePostgrestFilterValue,
  parseCallbackPayload,
};

async function handleCallbackQuery(callback: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
  const callbackId = callback.id;
  const payload = parseCallbackPayload(callback.data);
  const chatId = callback.message?.chat.id;

  if (!payload) {
    await answerCallbackQuery(callbackId, { text: "⚠️ Неизвестное действие. Откройте /help." });
    return;
  }

  await answerCallbackQuery(callbackId);
  if (!chatId) return;

  if (payload === "help") {
    await sendMessage({
      chatId,
      text: withExplicitLinksFallback(MSG.WELCOME),
      parseMode: "Markdown",
      replyMarkup: buildTelegramActionKeyboard(),
    });
    return;
  }

  if (payload === "scenario:ask_question") {
    await sendMessage({
      chatId,
      text: "❓ Напишите вопрос в свободной форме — я подберу подходящий сценарий и отвечу.",
    });
    return;
  }

  if (payload === "auth:start") {
    const fromId = callback.from?.id;
    if (fromId) await setTelegramAuthState(fromId, "await_profile", {});
    await sendMessage({
      chatId,
      text: [MSG.AUTH_START, "", MSG.AUTH_ASK_PROFILE].join("\n"),
      parseMode: "Markdown",
      replyMarkup: buildTelegramAuthStartKeyboard(),
    });
    return;
  }

  if (payload === "auth:cancel") {
    const fromId = callback.from?.id;
    if (fromId) await setTelegramAuthState(fromId, "idle", {});
    await sendMessage({
      chatId,
      text: MSG.AUTH_CANCELLED,
      parseMode: "Markdown",
      replyMarkup: buildTelegramAuthStartKeyboard(),
    });
    return;
  }

  if (payload.startsWith("auth:confirm:")) {
    const fromId = callback.from?.id;
    if (!fromId) return;

    const candidateUserId = payload.slice("auth:confirm:".length).trim();
    const auth = await getTelegramAuthRecord(fromId);
    if (auth.state !== "await_confirm" || auth.context.candidateUserId !== candidateUserId) {
      await sendMessage({
        chatId,
        text: "⚠️ Подтверждение устарело. Нажмите «🔐 Начать авторизацию» и попробуйте снова.",
      });
      return;
    }

    await setTelegramAuthAuthorized(fromId, candidateUserId);
    await setTelegramAuthState(fromId, "idle", {});
    await sendMessage({
      chatId,
      text: MSG.AUTH_SUCCESS,
      replyMarkup: buildTelegramActionKeyboard(),
    });
    return;
  }

  await sendMessage({
    chatId,
    text: "📎 Отправьте PDF/TXT/MD файлом в этот чат. После загрузки можно сразу задать вопрос по документу.",
  });
}

// Минимальное экранирование для inline-кода (Markdown legacy)
function escapeMd(s: string): string {
  return s.replace(/([`*_\[])/g, "\\$1");
}

function isForwardedMedia(message: TelegramMessage): boolean {
  const m = message as TelegramMessage & Record<string, unknown>;
  return Boolean(m.forward_origin || m.forward_from || m.forward_date || m.forward_from_chat);
}
