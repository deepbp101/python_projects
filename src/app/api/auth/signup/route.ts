import { badRequest, ok, parseBody, route } from "@/lib/api";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";

export const POST = route(async (request: Request) => {
  const { name, email, password } = await parseBody(request, signupSchema);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw badRequest("An account with that email already exists.");
  }

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
  });

  // Any pending invites addressed to this email now belong to the new account.
  await prisma.collaborator.updateMany({
    where: { email, userId: null, status: "INVITED" },
    data: { userId: user.id },
  });

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
  });

  return ok({ id: user.id, email: user.email, name: user.name }, 201);
});
