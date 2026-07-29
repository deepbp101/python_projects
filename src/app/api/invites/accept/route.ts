import { ApiError, ok, parseBody, requireUser, route } from "@/lib/api";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { acceptInviteSchema } from "@/lib/validation";

/**
 * Accepts a workspace invite. The signed-in account is attached to the
 * collaborator row and the token is burned, so a leaked link cannot be reused.
 */
export const POST = route(async (request: Request) => {
  const user = await requireUser();
  const { token } = await parseBody(request, acceptInviteSchema);

  const collaborator = await prisma.collaborator.findUnique({
    where: { inviteTokenHash: hashToken(token) },
    include: { wedding: { select: { id: true, slug: true, title: true } } },
  });

  if (!collaborator || collaborator.status === "REMOVED") {
    throw new ApiError(404, "That invite link is not valid.");
  }
  if (
    collaborator.inviteExpiresAt &&
    collaborator.inviteExpiresAt.getTime() < Date.now()
  ) {
    throw new ApiError(410, "That invite has expired. Ask for a new one.");
  }
  if (collaborator.email !== user.email) {
    throw new ApiError(
      403,
      `That invite was sent to ${collaborator.email}. Sign in with that address to accept it.`,
    );
  }

  await prisma.collaborator.update({
    where: { id: collaborator.id },
    data: {
      userId: user.id,
      status: "ACTIVE",
      joinedAt: collaborator.joinedAt ?? new Date(),
      inviteTokenHash: null,
      inviteExpiresAt: null,
    },
  });

  broadcastChange(collaborator.weddingId, "collaborators", user.id);

  return ok({ wedding: collaborator.wedding });
});
