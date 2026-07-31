/**
 * Pro unlock codes.
 *
 * Pro is bought once for one wedding rather than rented, so the thing a couple
 * receives is a code, not a login to a billing portal. These are the pure parts:
 * what a code looks like, and how to get from what someone typed to what is
 * stored. Minting and redeeming live in `src/lib/services/plan.ts`.
 */

/**
 * Deliberately missing `I`, `O`, `0` and `1`.
 *
 * Codes get read off a screen, written on a card and typed by someone who is
 * planning a wedding and does not want a puzzle. Removing the four characters
 * people confuse costs about a bit and a half of entropy and removes the entire
 * class of "it says it's wrong but I typed it right".
 */
export const UNLOCK_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const UNLOCK_PREFIX = "WED";
/** Four groups of four: 20 characters of alphabet, ~99 bits. */
export const UNLOCK_GROUPS = 4;
export const UNLOCK_GROUP_SIZE = 4;
const BODY_LENGTH = UNLOCK_GROUPS * UNLOCK_GROUP_SIZE;

/**
 * What someone typed, reduced to what is stored.
 *
 * Case, spaces, dashes and the `WED` prefix are all presentation. Someone
 * pasting `wed-7k3m 9qrs...` and someone typing the bare body must land on the
 * same hash, or the code "does not work" for reasons nobody can see.
 */
export function normalizeUnlockCode(input: string): string {
  const bare = input.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // The prefix is only stripped when doing so leaves exactly a body. Stripping
  // unconditionally would corrupt the one-in-thirty-thousand code whose body
  // happens to start with WED, and only when typed without its prefix — a bug
  // that would look like "this code just doesn't work" and reproduce for nobody.
  if (
    bare.length === UNLOCK_PREFIX.length + BODY_LENGTH &&
    bare.startsWith(UNLOCK_PREFIX)
  ) {
    return bare.slice(UNLOCK_PREFIX.length);
  }

  return bare;
}

/** The readable form: `WED-7K3M-PQRS-42XT-9BCD`. */
export function formatUnlockCode(body: string): string {
  const groups = body.match(new RegExp(`.{1,${UNLOCK_GROUP_SIZE}}`, "g")) ?? [];
  return [UNLOCK_PREFIX, ...groups].join("-");
}

/**
 * Whether this could be a code at all.
 *
 * Checked before touching the database so a stray paste is answered as a typo
 * rather than as "no such code", which reads like an accusation.
 */
export function looksLikeUnlockCode(normalized: string): boolean {
  if (normalized.length !== BODY_LENGTH) return false;
  return [...normalized].every((character) =>
    UNLOCK_ALPHABET.includes(character),
  );
}
