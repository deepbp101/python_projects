import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque tokens for sessions and invites.
 *
 * The raw token only ever exists in a cookie or an invite link; the database
 * stores a SHA-256 hash of it, keyed with AUTH_SECRET. That keeps a database
 * dump from yielding usable sessions or invite links.
 */

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Copy .env.example to .env and set a long random value.",
    );
  }
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

/** Constant-time comparison, for the rare case two hashes are compared in app code. */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
