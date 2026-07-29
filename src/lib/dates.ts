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
