import {
  badRequest,
  notFound,
  ok,
  parseBody,
  requireWorkspaceOwner,
  route,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { resolveAllAccess } from "@/lib/permissions";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateCollaboratorSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; collaboratorId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, collaboratorId } = await params;
  const context = await requireWorkspaceOwner(weddingId);
  const input = await parseBody(request, updateCollaboratorSchema);

  const collaborator = await prisma.collaborator.findFirst({
    where: { id: collaboratorId, weddingId },
  });
  if (!collaborator) throw notFound("That collaborator does not exist.");
  if (collaborator.role === "OWNER") {
    throw badRequest("The owner's access cannot be changed.");
  }

  const updated = await prisma.collaborator.update({
    where: { id: collaboratorId },
    data: {
      ...(input.role ? { role: input.role } : {}),
      ...(input.permissions
        ? { permissions: { deleteMany: {}, create: input.permissions } }
        : {}),
    },
    include: { permissions: true },
  });

  broadcastChange(weddingId, "collaborators", context.user.id);

  return ok({
    collaborator: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      status: updated.status,
      access: resolveAllAccess(updated.role, updated.permissions),
    },
  });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, collaboratorId } = await params;
  const context = await requireWorkspaceOwner(weddingId);

  const collaborator = await prisma.collaborator.findFirst({
    where: { id: collaboratorId, weddingId },
  });
  if (!collaborator) throw notFound("That collaborator does not exist.");
  if (collaborator.role === "OWNER") {
    throw badRequest("The owner cannot be removed from their own wedding.");
  }

  // Marked REMOVED rather than deleted so their task assignments survive.
  await prisma.collaborator.update({
    where: { id: collaboratorId },
    data: { status: "REMOVED", inviteTokenHash: null, inviteExpiresAt: null },
  });

  broadcastChange(weddingId, "collaborators", context.user.id);
  return ok({ ok: true });
});
