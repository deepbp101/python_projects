import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  callerAddress,
  decide,
  retryAfterFor,
  windowStartFor,
  type WindowSpec,
} from "@/lib/domain/limits";

export type { WindowSpec };

/**
 * Rate limiting for endpoints with no account behind them.
 *
 * Fixed windows in the database rather than a token bucket in memory. Two
 * reasons: a restart must not hand an abuser a fresh allowance, and this app can
 * legitimately run as more than one process behind a load balancer, where
 * per-process memory counters would multiply the real limit by the process count.
 *
 * Fixed windows can allow up to twice the nominal rate across a window boundary.
 * That is a known and acceptable property here — the job is to stop a script
 * dumping ten thousand photos into a gallery, not to meter an API to the second.
 */

/**
 * Identifies the caller, without keeping their address.
 *
 * The address is hashed with AUTH_SECRET before it is stored. A guest posting a
 * photo has not agreed to us keeping their IP, and we do not need it — only
 * whether two requests came from the same place.
 */
export function clientFingerprint(request: Request): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256")
    .update(`${secret}:ratelimit:${callerAddress(request.headers)}`)
    .digest("hex")
    .slice(0, 32);
}

export type LimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window rolls over. */
  retryAfter: number;
};

/**
 * Counts one hit against a bucket and reports whether it was allowed.
 *
 * The increment happens before the decision, so a rejected request still counts —
 * hammering a limited endpoint keeps it limited rather than resetting it.
 */
export async function consume(
  bucket: string,
  spec: WindowSpec,
  now: Date = new Date(),
): Promise<LimitResult> {
  const windowStart = windowStartFor(spec.seconds, now);

  const row = await prisma.rateLimit.upsert({
    where: { bucket_windowStart: { bucket, windowStart } },
    create: { bucket, windowStart, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  return {
    ...decide(spec, row.count),
    retryAfter: retryAfterFor(spec, now, windowStart),
  };
}

/**
 * 429 carrying `Retry-After`, so a well-behaved client knows when to come back.
 *
 * Sent both as the standard header and in the body, because the header is for
 * proxies and crawlers while the body is what the app's own fetch wrapper reads.
 */
export class RateLimitedError extends ApiError {
  constructor(retryAfter: number, message: string) {
    super(429, message, { retryAfter }, { "retry-after": String(retryAfter) });
  }
}

/**
 * Applies every window in order and throws on the first one exceeded.
 *
 * Endpoints pass a burst window and a slower sustained one: the first stops a
 * script, the second stops a patient script.
 */
export async function enforce(
  buckets: { bucket: string; spec: WindowSpec; message: string }[],
  now: Date = new Date(),
): Promise<void> {
  for (const entry of buckets) {
    const result = await consume(entry.bucket, entry.spec, now);
    if (!result.allowed) {
      throw new RateLimitedError(result.retryAfter, entry.message);
    }
  }
}

/** Windows used by the guest-facing endpoints. Specs live here, the maths in the domain. */
export const GUEST_BURST: WindowSpec = { seconds: 60, limit: 5 };
export const GUEST_SUSTAINED: WindowSpec = { seconds: 60 * 60, limit: 30 };
export const LOOKUP_WINDOW: WindowSpec = { seconds: 60 * 10, limit: 20 };
const DAY_SECONDS = 24 * 60 * 60;

/**
 * The guard every anonymous posting endpoint runs.
 *
 * Three windows, each stopping a different thing: a burst (someone holding down
 * the button), a sustained hourly rate (a patient script), and a per-wedding daily
 * cap from the plan (a whole crowd, or one determined person rotating addresses —
 * the daily bucket is keyed by wedding alone, so changing IP does not reset it).
 */
export async function guardGuestPost(
  request: Request,
  weddingId: string,
  dailyLimit: number,
  now: Date = new Date(),
): Promise<void> {
  const who = clientFingerprint(request);

  await enforce(
    [
      {
        bucket: `guest:${weddingId}:${who}`,
        spec: GUEST_BURST,
        message: "That's a lot at once — give it a minute and try again.",
      },
      {
        bucket: `guest-hour:${weddingId}:${who}`,
        spec: GUEST_SUSTAINED,
        message: "You've shared plenty for now. Try again a little later.",
      },
      {
        bucket: `guest-day:${weddingId}`,
        spec: { seconds: DAY_SECONDS, limit: dailyLimit },
        message:
          "This wedding has taken all it can hold today. Try again tomorrow.",
      },
    ],
    now,
  );
}

/** Limits a lookup that could otherwise be used to probe for names. */
export async function guardLookup(
  request: Request,
  scope: string,
  now: Date = new Date(),
): Promise<void> {
  await enforce(
    [
      {
        bucket: `lookup:${scope}:${clientFingerprint(request)}`,
        spec: LOOKUP_WINDOW,
        message: "Too many tries. Wait a few minutes and have another go.",
      },
    ],
    now,
  );
}

/**
 * Drops windows that closed long ago.
 *
 * Called opportunistically from the limited endpoints rather than on a schedule —
 * this app has no job runner, and the table is only written by the endpoints that
 * would clean it. A day of history is kept so daily buckets still resolve.
 */
export async function pruneOldWindows(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
}
