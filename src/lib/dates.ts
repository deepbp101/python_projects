/**
 * Date helpers that work in whole UTC days. Wedding planning is calendar-day
 * arithmetic, not instant arithmetic — doing this in local time makes tasks
 * jump a day across a DST boundary.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight UTC on the calendar day of `date`. */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/** Whole calendar days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / MS_PER_DAY,
  );
}

export type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  /** True once the wedding date has passed. */
  hasPassed: boolean;
};

/** Live countdown to the wedding, used by the dashboard widget. */
export function countdownTo(target: Date, now: Date = new Date()): Countdown {
  const totalMs = target.getTime() - now.getTime();
  const remaining = Math.max(totalMs, 0);
  return {
    days: Math.floor(remaining / MS_PER_DAY),
    hours: Math.floor((remaining / (60 * 60 * 1000)) % 24),
    minutes: Math.floor((remaining / (60 * 1000)) % 60),
    seconds: Math.floor((remaining / 1000) % 60),
    totalMs,
    hasPassed: totalMs <= 0,
  };
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Formats an instant in the wedding's own timezone.
 *
 * Event times are instants, not calendar days — a 4pm ceremony is 4pm where the
 * wedding is, whoever is reading. `timezone` is free text on the wedding, so an
 * unrecognised zone falls back to UTC rather than throwing: a typo in a settings
 * field must not take the public site down.
 */
function zoneOrUtc(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

export function formatTimeInZone(
  date: Date | string,
  timeZone: string | null | undefined,
): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneOrUtc(timeZone),
  });
}

export function formatDateTimeInZone(
  date: Date | string,
  timeZone: string | null | undefined,
): string {
  return new Date(date).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: zoneOrUtc(timeZone),
  });
}

/**
 * The calendar day an instant falls on **in the given zone**, as `YYYY-MM-DD`.
 *
 * For grouping, not display. `en-CA` is used because it formats as ISO order;
 * comparing these strings is how we tell "same day" without dragging a date
 * library in, and it must be done in the wedding's zone — an 8pm reception in New
 * York is already tomorrow in UTC, and would otherwise split across two days.
 */
export function dayKeyInZone(
  date: Date | string,
  timeZone: string | null | undefined,
): string {
  return new Date(date).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: zoneOrUtc(timeZone),
  });
}

/** "Wednesday, March 31, 2027" in the wedding's zone — a heading, not a key. */
export function formatDayInZone(
  date: Date | string,
  timeZone: string | null | undefined,
): string {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: zoneOrUtc(timeZone),
  });
}

/** The zone's short name — "EDT", "GMT+2" — so a guest knows which clock. */
export function timeZoneLabel(timeZone: string | null | undefined): string {
  const zone = zoneOrUtc(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "short",
  }).formatToParts(new Date());
  return parts.find((part) => part.type === "timeZoneName")?.value ?? zone;
}

export function formatLongDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
