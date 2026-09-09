/**
 * Auth constants with no Next.js imports.
 *
 * The Socket.IO server (server.ts) is plain Node running outside Next's
 * bootstrap, so it must not pull in `next/headers` — doing so loads Next's
 * request internals before their environment is set up. Keeping the cookie name
 * here lets both sides share it safely.
 */

export const SESSION_COOKIE = "wp_session";
export const SESSION_TTL_DAYS = 30;

/**
 * Reads a session token out of an Authorization header.
 *
 * The native app cannot use the session cookie: it is httpOnly by design, and
 * React Native has no cookie jar shared with the code making the request. The
 * token itself needs no change — it was always an opaque random string checked
 * against a SHA-256 hash, which is exactly what a bearer token is. Only the
 * delivery differs, so this is the whole of the difference.
 *
 * Kept here beside the cookie name, and free of Next imports, so the Socket.IO
 * server can use it too.
 */
export function bearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer") return null;
  const value = rest.join(" ");
  return value.length > 0 ? value : null;
}
