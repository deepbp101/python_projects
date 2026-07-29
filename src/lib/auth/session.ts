import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/auth/constants";
import { generateToken, hashToken } from "@/lib/auth/tokens";

export { SESSION_COOKIE };

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/** Issues a session and sets the cookie. Returns the raw token for tests. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
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

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's `cache` so a page that checks auth in a layout, a page and
 * a couple of components still only hits the database once per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
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
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    // deleteMany, not delete: a stale cookie should not throw.
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}

/** Best-effort cleanup of expired rows; called on login. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
