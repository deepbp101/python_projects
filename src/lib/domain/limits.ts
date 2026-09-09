/**
 * The arithmetic behind rate limiting, kept apart from the database and the
 * hashing so it can be reasoned about on its own.
 *
 * `src/lib/rate-limit.ts` is the enforcement: it hashes the address, counts hits
 * in Postgres and throws. Everything here is a pure function of its arguments.
 */

export type WindowSpec = {
  /** Window length in seconds. */
  seconds: number;
  /** Requests permitted per window. */
  limit: number;
};

/**
 * The start of the fixed window a moment falls in.
 *
 * Aligned to the epoch rather than to first contact, so every process agrees on
 * where a window begins without having to coordinate.
 */
export function windowStartFor(seconds: number, now: Date): Date {
  return new Date(Math.floor(now.getTime() / (seconds * 1000)) * seconds * 1000);
}

/** Seconds until the current window rolls over. Never zero — a client told to wait 0 retries immediately. */
export function retryAfterFor(
  spec: WindowSpec,
  now: Date,
  windowStart = windowStartFor(spec.seconds, now),
): number {
  const elapsed = (now.getTime() - windowStart.getTime()) / 1000;
  return Math.max(1, Math.ceil(spec.seconds - elapsed));
}

/**
 * Whether the nth hit in a window is allowed, given the count *after* it was
 * recorded. Counting first means a rejected request still counts, so hammering a
 * limited endpoint keeps it limited rather than resetting it.
 */
export function decide(
  spec: WindowSpec,
  countAfterHit: number,
): { allowed: boolean; remaining: number } {
  return {
    allowed: countAfterHit <= spec.limit,
    remaining: Math.max(0, spec.limit - countAfterHit),
  };
}

/**
 * The caller's address, as best it can be known.
 *
 * Behind a proxy the socket address is the proxy, so the forwarded header wins
 * where present — its first entry, which is the original client. That header is
 * client-settable, so this is a speed bump against casual abuse rather than proof
 * of identity; the durable protections are moderation and the couple's ability to
 * close a section entirely.
 */
export function callerAddress(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip")?.trim() || "unknown"
  );
}
