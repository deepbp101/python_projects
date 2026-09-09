/**
 * All money in this app is integer cents. Floats are never used for amounts —
 * `0.1 + 0.2` problems show up fast on a five-figure wedding budget.
 */

export function formatMoney(
  cents: number,
  currency = "USD",
  { showCents = false }: { showCents?: boolean } = {},
): string {
  const fractionDigits = showCents || cents % 100 !== 0 ? 2 : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100);
}

/**
 * Parses user input ("12,500", "$12,500.50") into cents. Returns null when the
 * input is not a usable amount, so callers can surface a validation error
 * rather than silently storing a zero.
 */
export function parseMoney(input: string | number): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "" || !/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Percentage of `total` represented by `part`, rounded to a whole number. */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return part > 0 ? 100 : 0;
  return Math.round((part / total) * 100);
}
