import { ApiError, ok, parseBody, route } from "@/lib/api";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, pruneExpiredSessions } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (request: Request) => {
  const { email, password, client } = await parseBody(request, loginSchema);

  const user = await prisma.user.findUnique({ where: { email } });

  // Same message and roughly the same work either way, so the response does not
  // reveal whether an account exists.
  const passwordOk = user
    ? await verifyPassword(password, user.passwordHash)
    : await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");

  if (!user || !passwordOk) {
    throw new ApiError(401, "That email and password do not match.");
  }

  await pruneExpiredSessions();
  const token = await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    setCookie: client === "web",
  });

  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    // Only ever returned to a client that asked for it. The web app is left
    // with no way to read its own session token, which is the point of the
    // httpOnly cookie.
    ...(client === "native" ? { token } : {}),
  });
});
