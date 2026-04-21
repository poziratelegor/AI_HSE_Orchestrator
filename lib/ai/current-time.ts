/**
 * Current date/time context for LLM prompts.
 *
 * Все workflow живут в часовом поясе Москвы (МСК, UTC+3) — у нас студенты
 * российских вузов, дедлайны и расписания всегда в локальном времени.
 *
 * Функции возвращают человекочитаемый блок, который инжектируется в системные
 * промпты, чтобы модель могла корректно интерпретировать относительные даты
 * («через неделю», «к понедельнику», «29.04») и считать сколько дней осталось.
 */

const MSK_OFFSET_MINUTES = 3 * 60; // UTC+3, без DST

const RU_WEEKDAYS = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

const RU_MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export interface CurrentDateContext {
  /** ISO дата в МСК (YYYY-MM-DD) — стабильна для use в JSON-схемах */
  isoDate: string;
  /** ISO datetime с таймзоной */
  isoDateTime: string;
  /** День недели на русском («понедельник») */
  weekday: string;
  /** Человекочитаемая дата («21 апреля 2026») */
  humanDate: string;
  /** Время в МСК «HH:MM» */
  timeMsk: string;
  /** Underlying Date объект (UTC момент времени now()) */
  utcNow: Date;
}

/** Forces optional override for tests; defaults to real `Date.now()`. */
export function getCurrentDateContext(now: Date = new Date()): CurrentDateContext {
  // Сдвигаем UTC-время в МСК, чтобы getUTC* методы вернули поля МСК-календаря.
  const mskMs = now.getTime() + MSK_OFFSET_MINUTES * 60_000;
  const msk = new Date(mskMs);

  const yyyy = msk.getUTCFullYear();
  const mm = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(msk.getUTCDate()).padStart(2, "0");
  const hh = String(msk.getUTCHours()).padStart(2, "0");
  const mi = String(msk.getUTCMinutes()).padStart(2, "0");

  const weekday = RU_WEEKDAYS[msk.getUTCDay()];
  const humanDate = `${msk.getUTCDate()} ${RU_MONTHS_GENITIVE[msk.getUTCMonth()]} ${yyyy}`;

  return {
    isoDate: `${yyyy}-${mm}-${dd}`,
    isoDateTime: `${yyyy}-${mm}-${dd}T${hh}:${mi}:00+03:00`,
    weekday,
    humanDate,
    timeMsk: `${hh}:${mi}`,
    utcNow: now,
  };
}

/**
 * Готовый блок для инжекта в системный промпт.
 *
 * Пример:
 *   ТЕКУЩИЕ ДАТА И ВРЕМЯ:
 *   - Сегодня: вторник, 21 апреля 2026 (2026-04-21)
 *   - Время в Москве: 14:32 (МСК, UTC+3)
 *   - При относительных датах («через неделю», «к понедельнику», «29.04»,
 *     «послезавтра») всегда отсчитывай от этой даты.
 *   - Если студент пишет дату без года (например «29.04») — подставляй
 *     ближайшую будущую дату (если 29.04 уже прошло — считай 29.04 следующего года).
 *   - Когда уместно, упоминай оставшееся количество дней («осталось 8 дней»).
 */
export function renderCurrentDateBlock(ctx: CurrentDateContext = getCurrentDateContext()): string {
  return [
    "ТЕКУЩИЕ ДАТА И ВРЕМЯ:",
    `- Сегодня: ${ctx.weekday}, ${ctx.humanDate} (${ctx.isoDate})`,
    `- Время в Москве: ${ctx.timeMsk} (МСК, UTC+3)`,
    "- Все относительные даты («сегодня», «завтра», «через неделю», «к понедельнику»,",
    "  «через 3 дня», «послезавтра») отсчитывай ТОЛЬКО от этой даты.",
    "- Если студент пишет дату без года («29.04», «15 мая») — подставляй ближайшую",
    "  будущую дату. Если эта дата уже прошла в текущем году — бери следующий год.",
    "- Когда уместно, считай и упоминай сколько дней осталось до события",
    "  («до экзамена 8 дней», «через 5 дней»).",
    "- В JSON-полях с датами используй ISO формат YYYY-MM-DD.",
  ].join("\n");
}
