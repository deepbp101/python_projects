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
