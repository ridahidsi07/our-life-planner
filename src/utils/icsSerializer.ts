import { CalendarEvent, Priority, TaskItem } from '../types/planner';

export interface IcsExportInput {
  tasks: TaskItem[];
  calendarEvents: CalendarEvent[];
  timeZone?: string;
  calendarName?: string;
  now?: Date;
}

export interface IcsValidationResult {
  valid: boolean;
  errors: string[];
}

const MAX_ICS_LINE_OCTETS = 75;
const textEncoder = new TextEncoder();

/**
 * Checks whether a string is a valid IANA time zone identifier supported by Intl.
 */
export function isValidIanaTimeZone(timeZone?: string): boolean {
  if (!timeZone || typeof timeZone !== 'string' || !timeZone.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks whether a timeZone string represents UTC/GMT rather than a regional IANA zone.
 */
export function isUtcTimeZone(timeZone?: string): boolean {
  if (!timeZone) return false;
  const normalized = timeZone.trim().toUpperCase();
  return (
    normalized === 'UTC' ||
    normalized === 'ETC/UTC' ||
    normalized === 'ETC/GMT' ||
    normalized === 'GMT' ||
    normalized === 'Z'
  );
}

/**
 * Escapes RFC 5545 Section 3.3.11 TEXT values.
 * Escapes backslash, semicolon, comma, and normalizes line breaks to literal "\n".
 */
export function escapeIcsText(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Formats an RFC 5545 parameter value, quoting if it contains ':', ';', or ','.
 */
export function formatIcsParamValue(value: string): string {
  const clean = String(value).replace(/[\r\n"]/g, '');
  if (/[:;,]/.test(clean)) {
    return `"${clean}"`;
  }
  return clean;
}

/**
 * Folds a single content line at 75 UTF-8 octets using CRLF followed by a single space,
 * without splitting multi-byte UTF-8 characters across fold boundaries (RFC 5545 Section 3.1).
 */
export function foldIcsLine(line: string): string {
  if (textEncoder.encode(line).length <= MAX_ICS_LINE_OCTETS) {
    return line;
  }

  const segments: string[] = [];
  let currentSegment = '';
  let currentBytes = 0;
  let maxBytesForCurrentLine = MAX_ICS_LINE_OCTETS;

  for (const char of line) {
    const charBytes = textEncoder.encode(char).length;
    if (currentBytes + charBytes > maxBytesForCurrentLine && currentSegment.length > 0) {
      segments.push(currentSegment);
      currentSegment = char;
      currentBytes = charBytes;
      // Continuation lines start with a single leading space (1 octet), leaving 74 octets for content
      maxBytesForCurrentLine = MAX_ICS_LINE_OCTETS - 1;
    } else {
      currentSegment += char;
      currentBytes += charBytes;
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments.join('\r\n ');
}

/**
 * Serializes a single RFC 5545 property line (`NAME *(;PARAM=VAL) : VALUE`) and applies 75-octet folding.
 * Always includes the required ':' separator between the property/parameter declaration and value.
 */
export function serializeIcsProperty(
  name: string,
  value: string,
  params?: Record<string, string | undefined>
): string {
  const propName = name.trim().toUpperCase();
  let paramPart = '';
  if (params) {
    for (const [rawKey, rawVal] of Object.entries(params)) {
      if (rawVal !== undefined && rawVal !== '') {
        paramPart += `;${rawKey.trim().toUpperCase()}=${formatIcsParamValue(rawVal)}`;
      }
    }
  }
  return foldIcsLine(`${propName}${paramPart}:${value}`);
}

/**
 * Formats a YYYY-MM-DD string as an RFC 5545 DATE value (YYYYMMDD).
 */
export function formatIcsDateValue(dateStr: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid date string for iCalendar export: "${dateStr}"`);
  }
  return `${match[1]}${match[2]}${match[3]}`;
}

/**
 * Parses an HH:mm time string into hours and minutes (00-23, 00-59).
 */
export function parseTimeHm(timeStr: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return { hours, minutes };
}

/**
 * Adds a number of calendar days to a YYYY-MM-DD date string and returns YYYY-MM-DD.
 */
export function addDaysToIsoDate(dateStr: string, daysToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + daysToAdd));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a YYYY-MM-DD and HH:mm pair as an RFC 5545 local DATE-TIME value (YYYYMMDDTHHmm00).
 */
export function formatIcsLocalDateTimeValue(dateStr: string, timeStr: string): string {
  const cleanDate = formatIcsDateValue(dateStr);
  const parsed = parseTimeHm(timeStr);
  if (!parsed) {
    throw new Error(`Invalid time string for iCalendar export: "${timeStr}"`);
  }
  const hh = String(parsed.hours).padStart(2, '0');
  const mm = String(parsed.minutes).padStart(2, '0');
  return `${cleanDate}T${hh}${mm}00`;
}

/**
 * Formats a Date or ISO date string as an RFC 5545 UTC DATE-TIME timestamp (YYYYMMDDTHHmmssZ).
 */
export function formatIcsUtcTimestamp(input: Date | string = new Date()): string {
  let dt: Date;
  if (input instanceof Date) {
    dt = input;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    dt = new Date(`${input.trim()}T00:00:00Z`);
  } else {
    dt = new Date(input);
  }
  if (Number.isNaN(dt.getTime())) {
    dt = new Date();
  }
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Formats a positive duration in minutes as an RFC 5545 DURATION value (e.g. PT1H30M, PT45M, PT1H).
 */
export function formatIcsDurationMinutes(totalMinutes: number): string {
  const clamped = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  if (hours > 0 && minutes > 0) {
    return `PT${hours}H${minutes}M`;
  }
  if (hours > 0) {
    return `PT${hours}H`;
  }
  return `PT${minutes}M`;
}

/**
 * Computes the duration in minutes between startTime (HH:mm) and endTime (HH:mm).
 * If endTime <= startTime, treats endTime as rolling over past midnight (+24h).
 */
export function calculateDurationMinutes(
  startTime: string,
  endTime?: string,
  defaultMinutes = 60
): number {
  const start = parseTimeHm(startTime);
  if (!start) return defaultMinutes;
  if (!endTime) return defaultMinutes;
  const end = parseTimeHm(endTime);
  if (!end) return defaultMinutes;

  const startMins = start.hours * 60 + start.minutes;
  let endMins = end.hours * 60 + end.minutes;
  if (endMins <= startMins) {
    endMins += 24 * 60;
  }
  return endMins - startMins;
}

/**
 * Adds minutes to a (dateStr, timeStr) pair and returns the resulting (endDateStr, endTimeStr).
 */
export function addMinutesToDateTime(
  dateStr: string,
  timeStr: string,
  durationMinutes: number
): { dateStr: string; timeStr: string } {
  const start = parseTimeHm(timeStr) || { hours: 0, minutes: 0 };
  const totalMinutes = start.hours * 60 + start.minutes + Math.max(1, Math.round(durationMinutes));
  const daysDelta = Math.floor(totalMinutes / (24 * 60));
  const remainderMinutes = totalMinutes % (24 * 60);
  const endHours = String(Math.floor(remainderMinutes / 60)).padStart(2, '0');
  const endMins = String(remainderMinutes % 60).padStart(2, '0');
  return {
    dateStr: daysDelta > 0 ? addDaysToIsoDate(dateStr, daysDelta) : dateStr,
    timeStr: `${endHours}:${endMins}`,
  };
}

/**
 * Maps Planner Priority to RFC 5545 Section 3.8.1.9 PRIORITY integer (1 = highest, 9 = lowest).
 */
export function mapPriorityToIcs(priority: Priority): string {
  switch (priority) {
    case 'urgent':
      return '1';
    case 'high':
      return '2';
    case 'medium':
      return '5';
    case 'low':
      return '7';
    case 'lowest':
      return '9';
    default:
      return '5';
  }
}

/**
 * Computes the UTC offset in minutes for a given UTC Date in an IANA timeZone,
 * and formats it as an RFC 5545 utc-offset string (+HHMM or -HHMM).
 */
function getIcsUtcOffsetForZone(timeZone: string, probeDate: Date): {
  offsetMinutes: number;
  offsetStr: string;
  tzName: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(probeDate);
    const map: Record<string, string> = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }
    const hour = Number(map.hour === '24' ? '0' : map.hour);
    const localAsUtcMs = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      hour,
      Number(map.minute),
      Number(map.second)
    );
    const offsetMinutes = Math.round((localAsUtcMs - probeDate.getTime()) / 60000);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMins = Math.abs(offsetMinutes);
    const hh = String(Math.floor(absMins / 60)).padStart(2, '0');
    const mm = String(absMins % 60).padStart(2, '0');
    const tzName = (map.timeZoneName || timeZone).replace(/[^A-Za-z0-9+-]/g, '') || 'LOCAL';
    return {
      offsetMinutes,
      offsetStr: `${sign}${hh}${mm}`,
      tzName,
    };
  } catch {
    return {
      offsetMinutes: 0,
      offsetStr: '+0000',
      tzName: 'UTC',
    };
  }
}

/**
 * Generates an RFC 5545 Section 3.6.5 VTIMEZONE component for a valid IANA timeZone.
 */
export function buildVTimezoneLines(timeZone: string, referenceYear = 2026): string[] {
  const janDate = new Date(Date.UTC(referenceYear, 0, 15, 12, 0, 0));
  const julDate = new Date(Date.UTC(referenceYear, 6, 15, 12, 0, 0));
  const janInfo = getIcsUtcOffsetForZone(timeZone, janDate);
  const julInfo = getIcsUtcOffsetForZone(timeZone, julDate);

  const lines: string[] = [
    serializeIcsProperty('BEGIN', 'VTIMEZONE'),
    serializeIcsProperty('TZID', timeZone),
    serializeIcsProperty('X-LIC-LOCATION', timeZone),
  ];

  if (janInfo.offsetMinutes === julInfo.offsetMinutes) {
    lines.push(
      serializeIcsProperty('BEGIN', 'STANDARD'),
      serializeIcsProperty('DTSTART', '19700101T000000'),
      serializeIcsProperty('TZOFFSETFROM', janInfo.offsetStr),
      serializeIcsProperty('TZOFFSETTO', janInfo.offsetStr),
      serializeIcsProperty('TZNAME', janInfo.tzName),
      serializeIcsProperty('END', 'STANDARD')
    );
  } else {
    const isJanStandard = janInfo.offsetMinutes < julInfo.offsetMinutes;
    const stdInfo = isJanStandard ? janInfo : julInfo;
    const dstInfo = isJanStandard ? julInfo : janInfo;

    lines.push(
      serializeIcsProperty('BEGIN', 'STANDARD'),
      serializeIcsProperty('DTSTART', '19701101T020000'),
      serializeIcsProperty('TZOFFSETFROM', dstInfo.offsetStr),
      serializeIcsProperty('TZOFFSETTO', stdInfo.offsetStr),
      serializeIcsProperty('TZNAME', stdInfo.tzName),
      serializeIcsProperty('END', 'STANDARD'),
      serializeIcsProperty('BEGIN', 'DAYLIGHT'),
      serializeIcsProperty('DTSTART', '19700308T020000'),
      serializeIcsProperty('TZOFFSETFROM', stdInfo.offsetStr),
      serializeIcsProperty('TZOFFSETTO', dstInfo.offsetStr),
      serializeIcsProperty('TZNAME', dstInfo.tzName),
      serializeIcsProperty('END', 'DAYLIGHT')
    );
  }

  lines.push(serializeIcsProperty('END', 'VTIMEZONE'));
  return lines;
}

/**
 * Serializes a DATE or DATE-TIME property (DTSTART, DTEND, DUE) with consistent timezone semantics.
 */
function serializeDateOrDateTimeProperty(
  propName: 'DTSTART' | 'DTEND' | 'DUE',
  dateStr: string,
  timeStr: string | undefined,
  timeZoneMode: { mode: 'iana'; tzid: string } | { mode: 'utc' } | { mode: 'floating' }
): string {
  if (!timeStr) {
    return serializeIcsProperty(propName, formatIcsDateValue(dateStr), { VALUE: 'DATE' });
  }
  const localDt = formatIcsLocalDateTimeValue(dateStr, timeStr);
  if (timeZoneMode.mode === 'iana') {
    return serializeIcsProperty(propName, localDt, { TZID: timeZoneMode.tzid });
  }
  if (timeZoneMode.mode === 'utc') {
    return serializeIcsProperty(propName, `${localDt}Z`);
  }
  return serializeIcsProperty(propName, localDt);
}

/**
 * Serializes tasks and calendar events into a standards-compliant RFC 5545 iCalendar (.ics) string.
 *
 * Key guarantees:
 * 1. Tasks are exported as RFC 5545 `VTODO` components with valid `VTODO` statuses
 *    (`NEEDS-ACTION`, `IN-PROCESS`, `COMPLETED`) and preserved durations (`DURATION` or `DUE`).
 *    `STATUS:COMPLETED` is never emitted inside a `VEVENT`.
 * 2. Calendar events are exported as RFC 5545 `VEVENT` components with `STATUS:CONFIRMED`
 *    and preserved durations (`DTSTART` to `DTEND` for timed events, or exclusive next-day
 *    `DTEND;VALUE=DATE` for all-day events).
 * 3. Every property line is serialized via `serializeIcsProperty` with a mandatory `:` separator,
 *    RFC 5545 text escaping, explicit timezone handling (`VTIMEZONE` + `TZID`), and 75-octet CRLF folding.
 */
export function serializePlannerCalendarToIcs({
  tasks,
  calendarEvents,
  timeZone,
  calendarName = 'Our Life Planner',
  now = new Date(),
}: IcsExportInput): string {
  const dtstamp = formatIcsUtcTimestamp(now);
  const trimmedTz = timeZone?.trim();

  let timeZoneMode: { mode: 'iana'; tzid: string } | { mode: 'utc' } | { mode: 'floating' } = {
    mode: 'floating',
  };
  if (trimmedTz && isUtcTimeZone(trimmedTz)) {
    timeZoneMode = { mode: 'utc' };
  } else if (trimmedTz && isValidIanaTimeZone(trimmedTz)) {
    timeZoneMode = { mode: 'iana', tzid: trimmedTz };
  }

  const lines: string[] = [
    serializeIcsProperty('BEGIN', 'VCALENDAR'),
    serializeIcsProperty('VERSION', '2.0'),
    serializeIcsProperty('PRODID', '-//Our Life Planner//Calendar Export 2.0//EN'),
    serializeIcsProperty('CALSCALE', 'GREGORIAN'),
    serializeIcsProperty('METHOD', 'PUBLISH'),
    serializeIcsProperty('X-WR-CALNAME', escapeIcsText(calendarName)),
  ];

  if (timeZoneMode.mode === 'iana') {
    lines.push(serializeIcsProperty('X-WR-TIMEZONE', timeZoneMode.tzid));
    lines.push(...buildVTimezoneLines(timeZoneMode.tzid, now.getUTCFullYear()));
  } else if (timeZoneMode.mode === 'utc') {
    lines.push(serializeIcsProperty('X-WR-TIMEZONE', 'UTC'));
  }

  // 1. Export Tasks as RFC 5545 VTODO components
  for (const task of tasks) {
    if (!task.dueDate || task.isArchived) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate.trim())) continue;

    const rawStartTime = !task.isAllDay ? task.scheduledStart || task.dueTime : undefined;
    const validStartTime =
      rawStartTime && parseTimeHm(rawStartTime) ? rawStartTime.trim() : undefined;
    const validScheduledEnd =
      !task.isAllDay && task.scheduledEnd && parseTimeHm(task.scheduledEnd)
        ? task.scheduledEnd.trim()
        : undefined;

    lines.push(serializeIcsProperty('BEGIN', 'VTODO'));
    lines.push(serializeIcsProperty('UID', `task-${task.id}@ourlifeplanner.app`));
    lines.push(serializeIcsProperty('DTSTAMP', dtstamp));
    lines.push(serializeIcsProperty('SUMMARY', escapeIcsText(task.title)));

    if (task.description && task.description.trim()) {
      lines.push(serializeIcsProperty('DESCRIPTION', escapeIcsText(task.description.trim())));
    }

    if (task.category && task.category.trim()) {
      lines.push(
        serializeIcsProperty('CATEGORIES', `Task,${escapeIcsText(task.category.trim())}`)
      );
    } else {
      lines.push(serializeIcsProperty('CATEGORIES', 'Task'));
    }

    lines.push(serializeIcsProperty('PRIORITY', mapPriorityToIcs(task.priority)));

    if (task.createdAt) {
      lines.push(serializeIcsProperty('CREATED', formatIcsUtcTimestamp(task.createdAt)));
    }

    if (validStartTime) {
      lines.push(
        serializeDateOrDateTimeProperty('DTSTART', task.dueDate, validStartTime, timeZoneMode)
      );
      if (validScheduledEnd) {
        const durationMins = calculateDurationMinutes(validStartTime, validScheduledEnd, 30);
        lines.push(serializeIcsProperty('DURATION', formatIcsDurationMinutes(durationMins)));
      } else if (task.scheduledStart && !task.dueTime) {
        lines.push(serializeIcsProperty('DURATION', formatIcsDurationMinutes(30)));
      } else {
        const dueTimeToUse =
          task.dueTime && parseTimeHm(task.dueTime) ? task.dueTime.trim() : validStartTime;
        const durationToDue = calculateDurationMinutes(validStartTime, dueTimeToUse, 0);
        if (dueTimeToUse !== validStartTime && durationToDue > 0) {
          const endDt = addMinutesToDateTime(task.dueDate, validStartTime, durationToDue);
          lines.push(
            serializeDateOrDateTimeProperty('DUE', endDt.dateStr, endDt.timeStr, timeZoneMode)
          );
        } else {
          lines.push(
            serializeDateOrDateTimeProperty('DUE', task.dueDate, dueTimeToUse, timeZoneMode)
          );
        }
      }
    } else {
      lines.push(serializeDateOrDateTimeProperty('DTSTART', task.dueDate, undefined, timeZoneMode));
      lines.push(serializeDateOrDateTimeProperty('DUE', task.dueDate, undefined, timeZoneMode));
    }

    if (task.status === 'completed') {
      lines.push(serializeIcsProperty('STATUS', 'COMPLETED'));
      lines.push(serializeIcsProperty('PERCENT-COMPLETE', '100'));
      lines.push(
        serializeIcsProperty(
          'COMPLETED',
          formatIcsUtcTimestamp(task.completedAt || now)
        )
      );
    } else if (task.status === 'in_progress') {
      lines.push(serializeIcsProperty('STATUS', 'IN-PROCESS'));
      lines.push(serializeIcsProperty('PERCENT-COMPLETE', '50'));
    } else {
      lines.push(serializeIcsProperty('STATUS', 'NEEDS-ACTION'));
      lines.push(serializeIcsProperty('PERCENT-COMPLETE', '0'));
    }

    lines.push(serializeIcsProperty('END', 'VTODO'));
  }

  // 2. Export Calendar Events as RFC 5545 VEVENT components
  for (const ev of calendarEvents) {
    if (!ev.date || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date.trim())) continue;

    const validStartTime =
      !ev.isAllDay && ev.startTime && parseTimeHm(ev.startTime)
        ? ev.startTime.trim()
        : undefined;
    const validEndTime =
      !ev.isAllDay && ev.endTime && parseTimeHm(ev.endTime) ? ev.endTime.trim() : undefined;

    lines.push(serializeIcsProperty('BEGIN', 'VEVENT'));
    lines.push(serializeIcsProperty('UID', `event-${ev.id}@ourlifeplanner.app`));
    lines.push(serializeIcsProperty('DTSTAMP', dtstamp));
    lines.push(serializeIcsProperty('SUMMARY', escapeIcsText(ev.title)));

    if (ev.notes && ev.notes.trim()) {
      lines.push(serializeIcsProperty('DESCRIPTION', escapeIcsText(ev.notes.trim())));
    }

    const categoryLabel =
      ev.type === 'birthday'
        ? 'Birthday'
        : ev.type === 'free_time'
        ? 'Focus time'
        : 'Event';
    lines.push(serializeIcsProperty('CATEGORIES', escapeIcsText(categoryLabel)));
    lines.push(serializeIcsProperty('STATUS', 'CONFIRMED'));
    lines.push(
      serializeIcsProperty(
        'TRANSP',
        ev.type === 'free_time' || ev.type === 'birthday' ? 'TRANSPARENT' : 'OPAQUE'
      )
    );

    if (validStartTime) {
      const durationMinutes = calculateDurationMinutes(validStartTime, validEndTime, 60);
      const endDateTime = addMinutesToDateTime(ev.date, validStartTime, durationMinutes);
      lines.push(
        serializeDateOrDateTimeProperty('DTSTART', ev.date, validStartTime, timeZoneMode)
      );
      lines.push(
        serializeDateOrDateTimeProperty(
          'DTEND',
          endDateTime.dateStr,
          endDateTime.timeStr,
          timeZoneMode
        )
      );
    } else {
      const nextDay = addDaysToIsoDate(ev.date, 1);
      lines.push(serializeDateOrDateTimeProperty('DTSTART', ev.date, undefined, timeZoneMode));
      lines.push(serializeDateOrDateTimeProperty('DTEND', nextDay, undefined, timeZoneMode));
    }

    if (ev.type === 'birthday') {
      lines.push(serializeIcsProperty('RRULE', 'FREQ=YEARLY'));
    }

    lines.push(serializeIcsProperty('END', 'VEVENT'));
  }

  lines.push(serializeIcsProperty('END', 'VCALENDAR'));
  return `${lines.join('\r\n')}\r\n`;
}

/**
 * Unfolds RFC 5545 folded lines (`\r\n ` or `\r\n\t`) into logical content lines.
 */
export function unfoldIcsLines(icsText: string): string[] {
  const unfolded = icsText.replace(/\r\n[ \t]/g, '');
  return unfolded
    .split(/\r\n/)
    .filter((line) => line.length > 0);
}

const VALID_VEVENT_STATUS = new Set(['TENTATIVE', 'CONFIRMED', 'CANCELLED']);
const VALID_VTODO_STATUS = new Set(['NEEDS-ACTION', 'COMPLETED', 'IN-PROCESS', 'CANCELLED']);

/**
 * Validates an iCalendar (.ics) payload against key RFC 5545 structural and property rules.
 */
export function validateIcsContent(icsText: string): IcsValidationResult {
  const errors: string[] = [];

  if (!icsText.includes('\r\n')) {
    errors.push('iCalendar content must use CRLF (\\r\\n) line endings (RFC 5545 Section 3.1).');
  }

  const rawLines = icsText.split('\r\n');
  if (rawLines[rawLines.length - 1] === '') {
    rawLines.pop();
  }

  rawLines.forEach((rawLine, idx) => {
    const byteLen = textEncoder.encode(rawLine).length;
    if (byteLen > MAX_ICS_LINE_OCTETS) {
      errors.push(
        `Line ${idx + 1} exceeds ${MAX_ICS_LINE_OCTETS} UTF-8 octets (${byteLen} octets).`
      );
    }
  });

  const logicalLines = unfoldIcsLines(icsText);
  if (logicalLines.length === 0) {
    errors.push('iCalendar content is empty.');
    return { valid: false, errors };
  }

  if (logicalLines[0] !== 'BEGIN:VCALENDAR') {
    errors.push(`First line must be BEGIN:VCALENDAR, found "${logicalLines[0]}".`);
  }
  if (logicalLines[logicalLines.length - 1] !== 'END:VCALENDAR') {
    errors.push(
      `Last line must be END:VCALENDAR, found "${logicalLines[logicalLines.length - 1]}".`
    );
  }

  const componentStack: string[] = [];
  const definedTimeZones = new Set<string>();
  const referencedTimeZones = new Set<string>();
  let hasVersion = false;
  let hasProdId = false;

  interface ComponentContext {
    type: string;
    props: Map<string, Array<{ params: Record<string, string>; value: string }>>;
  }
  const activeComponentStack: ComponentContext[] = [];

  logicalLines.forEach((line, lineIdx) => {
    // Find the first unquoted ':' separating property+params from value
    let colonIndex = -1;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ':' && !inQuotes) {
        colonIndex = i;
        break;
      }
    }

    if (colonIndex <= 0) {
      errors.push(
        `Logical line ${lineIdx + 1} is missing required ':' property/value separator: "${line}"`
      );
      return;
    }

    const leftPart = line.slice(0, colonIndex);
    const valuePart = line.slice(colonIndex + 1);

    // Split leftPart by unquoted ';'
    const segments: string[] = [];
    let current = '';
    inQuotes = false;
    for (let i = 0; i < leftPart.length; i++) {
      const ch = leftPart[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        current += ch;
      } else if (ch === ';' && !inQuotes) {
        segments.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    segments.push(current);

    const propName = segments[0].toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(propName)) {
      errors.push(`Logical line ${lineIdx + 1} has invalid property name "${propName}".`);
    }

    const params: Record<string, string> = {};
    for (let s = 1; s < segments.length; s++) {
      const seg = segments[s];
      const eqIdx = seg.indexOf('=');
      if (eqIdx <= 0) {
        errors.push(
          `Logical line ${lineIdx + 1} has malformed parameter "${seg}" (missing '=' or value separator): "${line}"`
        );
        continue;
      }
      const pKey = seg.slice(0, eqIdx).toUpperCase();
      const pVal = seg.slice(eqIdx + 1).replace(/^"(.*)"$/, '$1');
      if (!/^[A-Z0-9-]+$/.test(pKey) || !pVal) {
        errors.push(`Logical line ${lineIdx + 1} has invalid parameter "${seg}".`);
      }
      params[pKey] = pVal;
    }

    if (propName === 'BEGIN') {
      const compType = valuePart.toUpperCase();
      componentStack.push(compType);
      activeComponentStack.push({ type: compType, props: new Map() });
      return;
    }

    if (propName === 'END') {
      const compType = valuePart.toUpperCase();
      const expected = componentStack.pop();
      const finishedComp = activeComponentStack.pop();
      if (expected !== compType) {
        errors.push(
          `Logical line ${lineIdx + 1} has mismatched END:${compType} (expected END:${expected || 'NONE'}).`
        );
      }
      if (finishedComp) {
        if (finishedComp.type === 'VTIMEZONE') {
          const tzidEntries = finishedComp.props.get('TZID');
          if (!tzidEntries || tzidEntries.length === 0) {
            errors.push('VTIMEZONE component is missing required TZID property.');
          } else {
            definedTimeZones.add(tzidEntries[0].value);
          }
        } else if (finishedComp.type === 'VEVENT') {
          if (!finishedComp.props.has('UID')) {
            errors.push('VEVENT component is missing required UID property.');
          }
          if (!finishedComp.props.has('DTSTAMP')) {
            errors.push('VEVENT component is missing required DTSTAMP property.');
          }
          if (!finishedComp.props.has('DTSTART')) {
            errors.push('VEVENT component is missing required DTSTART property.');
          }
          if (finishedComp.props.has('DTEND') && finishedComp.props.has('DURATION')) {
            errors.push(
              'VEVENT component MUST NOT contain both DTEND and DURATION (RFC 5545 Section 3.6.1).'
            );
          }
          const statuses = finishedComp.props.get('STATUS') || [];
          for (const st of statuses) {
            if (!VALID_VEVENT_STATUS.has(st.value.toUpperCase())) {
              errors.push(
                `Invalid STATUS "${st.value}" inside VEVENT (RFC 5545 Section 3.8.1.11 only allows TENTATIVE, CONFIRMED, CANCELLED).`
              );
            }
          }
        } else if (finishedComp.type === 'VTODO') {
          if (!finishedComp.props.has('UID')) {
            errors.push('VTODO component is missing required UID property.');
          }
          if (!finishedComp.props.has('DTSTAMP')) {
            errors.push('VTODO component is missing required DTSTAMP property.');
          }
          if (finishedComp.props.has('DUE') && finishedComp.props.has('DURATION')) {
            errors.push(
              'VTODO component MUST NOT contain both DUE and DURATION (RFC 5545 Section 3.6.2).'
            );
          }
          if (finishedComp.props.has('DURATION') && !finishedComp.props.has('DTSTART')) {
            errors.push(
              'VTODO component with DURATION MUST also include DTSTART (RFC 5545 Section 3.6.2).'
            );
          }
          const statuses = finishedComp.props.get('STATUS') || [];
          for (const st of statuses) {
            if (!VALID_VTODO_STATUS.has(st.value.toUpperCase())) {
              errors.push(
                `Invalid STATUS "${st.value}" inside VTODO (RFC 5545 Section 3.8.1.11 only allows NEEDS-ACTION, COMPLETED, IN-PROCESS, CANCELLED).`
              );
            }
          }
        }
      }
      return;
    }

    const currentComp = activeComponentStack[activeComponentStack.length - 1];
    if (currentComp) {
      if (!currentComp.props.has(propName)) {
        currentComp.props.set(propName, []);
      }
      currentComp.props.get(propName)!.push({ params, value: valuePart });

      if (currentComp.type === 'VCALENDAR') {
        if (propName === 'VERSION' && valuePart === '2.0') hasVersion = true;
        if (propName === 'PRODID' && valuePart.trim().length > 0) hasProdId = true;
      }
    }

    if (params.TZID) {
      referencedTimeZones.add(params.TZID);
      if (params.VALUE === 'DATE') {
        errors.push(
          `Logical line ${lineIdx + 1} applies TZID to a VALUE=DATE property, which is forbidden by RFC 5545 Section 3.2.19.`
        );
      }
      if (valuePart.endsWith('Z')) {
        errors.push(
          `Logical line ${lineIdx + 1} applies TZID to a UTC value ending with 'Z', which is forbidden by RFC 5545 Section 3.2.19.`
        );
      }
    }

    if (propName === 'DTSTART' || propName === 'DTEND' || propName === 'DUE') {
      if (params.VALUE === 'DATE') {
        if (!/^\d{8}$/.test(valuePart)) {
          errors.push(
            `Logical line ${lineIdx + 1} has invalid DATE value "${valuePart}" for ${propName};VALUE=DATE.`
          );
        }
      } else if (!/^\d{8}T\d{6}Z?$/.test(valuePart)) {
        errors.push(
          `Logical line ${lineIdx + 1} has invalid DATE-TIME value "${valuePart}" for ${propName}.`
        );
      }
    }

    if (propName === 'DTSTAMP' || propName === 'COMPLETED' || propName === 'CREATED') {
      if (!/^\d{8}T\d{6}Z$/.test(valuePart)) {
        errors.push(
          `Logical line ${lineIdx + 1} requires UTC DATE-TIME (YYYYMMDDTHHmmssZ) for ${propName}, found "${valuePart}".`
        );
      }
    }
  });

  if (componentStack.length > 0) {
    errors.push(`Unclosed iCalendar components: ${componentStack.join(', ')}`);
  }
  if (!hasVersion) {
    errors.push('VCALENDAR is missing required VERSION:2.0 property.');
  }
  if (!hasProdId) {
    errors.push('VCALENDAR is missing required PRODID property.');
  }

  for (const tz of referencedTimeZones) {
    if (!definedTimeZones.has(tz)) {
      errors.push(
        `TZID "${tz}" is referenced on a property but no matching VTIMEZONE component is defined (RFC 5545 Section 3.2.19).`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
