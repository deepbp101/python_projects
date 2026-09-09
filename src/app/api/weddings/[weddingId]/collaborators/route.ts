import {
  badRequest,
  ok,
  parseBody,
  requireWorkspace,
  requireWorkspaceOwner,
  route,
} from "@/lib/api";
import type { AccessLevel, WorkspaceSection } from "@/generated/prisma/enums";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { defaultPermissionsForRole, resolveAllAccess } from "@/lib/permissions";
import { broadcastChange } from "@/lib/realtime/emit";
import { inviteCollaboratorSchema } from "@/lib/validation";
import { requireCapacity } from "@/lib/services/plan";

type Params = { params: Promise<{ weddingId: string }> };

const INVITE_TTL_DAYS = 14;

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "TASKS", "VIEW");

  const collaborators = await prisma.collaborator.findMany({
    where: { weddingId, status: { not: "REMOVED" } },
    include: { permissions: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  return ok({
    collaborators: collaborators.map((collaborator) => ({
      id: collaborator.id,
      email: collaborator.email,
      name: collaborator.name,
      role: collaborator.role,
      status: collaborator.status,
      joinedAt: collaborator.joinedAt,
      access: resolveAllAccess(collaborator.role, collaborator.permissions),
    })),
  });
});

/**
 * Invites a collaborator.
 *
 * The invite link is returned in the response rather than emailed — there is no
 * mail provider wired up yet, so the couple copies the link and sends it
 * themselves. Only the token's hash is stored.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspaceOwner(weddingId);
  const input = await parseBody(request, inviteCollaboratorSchema);

  // The couple are not counted — a plan caps the helpers you bring in, not the
  // two people getting married.
  await requireCapacity(weddingId, "collaborators", "invited helpers");

  const existing = await prisma.collaborator.findUnique({
    where: { weddingId_email: { weddingId, email: input.email } },
  });
  if (existing && existing.status === "ACTIVE") {
    throw badRequest("That person is already a collaborator.");
  }

  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  // An existing account is linked immediately so the invite shows up for them
  // without needing the link.
  const invitedUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  const permissions: { section: WorkspaceSection; access: AccessLevel }[] =
    input.permissions ??
    Object.entries(defaultPermissionsForRole(input.role)).map(
      ([section, access]) => ({
        section: section as WorkspaceSection,
        access,
      }),
    );

  const collaborator = await prisma.collaborator.upsert({
    where: { weddingId_email: { weddingId, email: input.email } },
    create: {
      weddingId,
      email: input.email,
      name: input.name ?? null,
      role: input.role,
      status: "INVITED",
      userId: invitedUser?.id ?? null,
      invitedById: context.user.id,
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: expiresAt,
      permissions: { create: permissions },
    },
    update: {
      name: input.name ?? null,
      role: input.role,
      status: "INVITED",
      userId: invitedUser?.id ?? null,
      invitedById: context.user.id,
      inviteTokenHash: hashToken(token),
      inviteExpiresAt: expiresAt,
      permissions: { deleteMany: {}, create: permissions },
    },
    include: { permissions: true },
  });

  broadcastChange(weddingId, "collaborators", context.user.id);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return ok(
    {
      collaborator: {
        id: collaborator.id,
        email: collaborator.email,
        name: collaborator.name,
        role: collaborator.role,
        status: collaborator.status,
        access: resolveAllAccess(collaborator.role, collaborator.permissions),
      },
      inviteUrl: `${appUrl}/invite/${token}`,
      expiresAt,
    },
    201,
  );
});
