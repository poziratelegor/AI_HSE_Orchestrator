/**
 * iCal (.ics) parser — zero dependencies.
 *
 * Supports the subset of RFC 5545 that matters for academic calendars:
 *   VEVENT with DTSTART, DTEND, SUMMARY, DESCRIPTION, LOCATION.
 *
 * Works with calendars exported from:
 *   - Google Calendar
 *   - Microsoft Outlook / Office 365
 *   - Apple iCal
 *   - HSE Timetable (timetable.hse.ru → export)
 *   - SmartLMS Moodle calendar export
 */

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  start: Date | null;
  end: Date | null;
  isAllDay: boolean;
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

/** Unfolds RFC 5545 line continuations (line starting with space/tab). */
function unfold(ics: string): string {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/** Parses iCal datetime string to JS Date. */
function parseIcalDate(value: string): { date: Date; isAllDay: boolean } | null {
  const clean = value.split(";").pop()?.trim() ?? value.trim();

  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(clean)) {
    const y = Number(clean.slice(0, 4));
    const m = Number(clean.slice(4, 6)) - 1;
    const d = Number(clean.slice(6, 8));
    return { date: new Date(y, m, d), isAllDay: true };
  }

  // Date-time: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
  const dtMatch = clean.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dtMatch) {
    const [, y, mo, d, h, mi, s, z] = dtMatch;
    const str = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`;
    return { date: new Date(str), isAllDay: false };
  }

  return null;
}

/** Decodes iCal text escaping (\, \;, \n, \N). */
function decodeIcalText(s: string): string {
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

/**
 * Parses an iCal (.ics) string into an array of CalendarEvent objects.
 * Non-VEVENT components (VTODO, VJOURNAL, VFREEBUSY) are ignored.
 */
export function parseIcal(ics: string): CalendarEvent[] {
  const unfolded = unfold(ics.replace(/\r\n/g, "\n"));
  const lines = unfolded.split("\n");

  const events: CalendarEvent[] = [];
  let inEvent = false;
  let current: Partial<CalendarEvent> & { startRaw?: string; endRaw?: string } = {};

  for (const raw of lines) {
    const line = raw.trim();

    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      current = { uid: crypto.randomUUID(), description: "", location: "", isAllDay: false };
      continue;
    }

    if (line === "END:VEVENT") {
      inEvent = false;

      // Parse dates
      if (current.startRaw) {
        const parsed = parseIcalDate(current.startRaw);
        if (parsed) {
          current.start = parsed.date;
          current.isAllDay = parsed.isAllDay;
        }
      }
      if (current.endRaw) {
        const parsed = parseIcalDate(current.endRaw);
        if (parsed) current.end = parsed.date;
      }

      if (current.summary && current.start) {
        events.push({
          uid: current.uid ?? crypto.randomUUID(),
          summary: current.summary,
          description: current.description ?? "",
          location: current.location ?? "",
          start: current.start ?? null,
          end: current.end ?? null,
          isAllDay: current.isAllDay ?? false
        });
      }

      current = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).toUpperCase();
    const value = line.slice(colonIdx + 1);

    // Keys can have parameters: DTSTART;TZID=Europe/Moscow:20241015T100000
    const baseKey = key.split(";")[0];

    switch (baseKey) {
      case "UID":
        current.uid = value.trim();
        break;
      case "SUMMARY":
        current.summary = decodeIcalText(value);
        break;
      case "DESCRIPTION":
        current.description = decodeIcalText(value);
        break;
      case "LOCATION":
        current.location = decodeIcalText(value);
        break;
      case "DTSTART":
        // Handle DTSTART;TZID=...:VALUE format
        if (key.includes(";")) {
          current.startRaw = line.split(":").slice(1).join(":");
        } else {
          current.startRaw = value.trim();
        }
        break;
      case "DTEND":
        current.endRaw = line.split(":").slice(1).join(":");
        break;
    }
  }

  return events;
}

/**
 * Filters events to only those with future dates (useful for task import).
 */
export function filterUpcomingEvents(
  events: CalendarEvent[],
  daysAhead = 90
): CalendarEvent[] {
  const now = new Date();
  const cutoff = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  return events.filter((e) => {
    if (!e.start) return false;
    return e.start >= now && e.start <= cutoff;
  });
}
