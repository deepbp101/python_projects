import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import {
  bearerToken,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
} from "@/lib/auth/constants";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export { SESSION_COOKIE };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/**
 * Issues a session and returns the raw token.
 *
 * `setCookie` is on for the web, where the token must never be readable by
 * JavaScript. The native app passes `false` and keeps the returned token in the
 * device keychain instead — a cookie it can neither read nor send would only be
 * dead weight on every response.
 */
export async function createSession(
  userId: string,
  meta: {
    userAgent?: string | null;
    ipAddress?: string | null;
    setCookie?: boolean;
  } = {},
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  });

  if (meta.setCookie !== false) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  return token;
}

/**
 * The session token for this request, from either delivery mechanism.
 *
 * Authorization wins over the cookie so a native client's identity is never
 * shadowed by a stale cookie left on the same connection.
 */
async function requestToken(): Promise<string | null> {
  const fromHeader = bearerToken((await headers()).get("authorization"));
  if (fromHeader) return fromHeader;
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's `cache` so a page that checks auth in a layout, a page and
 * a couple of components still only hits the database once per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await requestToken();
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarUrl: session.user.avatarUrl,
  };
});

export async function destroySession(): Promise<void> {
  const token = await requestToken();

  if (token) {
    // deleteMany, not delete: a stale token should not throw.
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  // Always cleared, even for a bearer caller: the row is gone either way, and
  // a native sign-out that left a cookie behind would be a surprise.
  (await cookies()).delete(SESSION_COOKIE);
}

/** Best-effort cleanup of expired rows; called on login. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
