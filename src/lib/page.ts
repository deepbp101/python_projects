import { notFound, redirect } from "next/navigation";
import type { AccessLevel, WorkspaceSection } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveAllAccess } from "@/lib/permissions";

/**
 * Server-component counterpart to `requireWorkspace`.
 *
 * Pages get the access map and decide what to render; the API routes remain the
 * enforcement point for anything that changes data.
 */
export async function loadWorkspace(weddingId: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/w/${weddingId}/dashboard`);

  const collaborator = await prisma.collaborator.findFirst({
    where: { weddingId, userId: user.id, status: "ACTIVE" },
    include: { wedding: true, permissions: true },
  });
  if (!collaborator) notFound();

  return {
    user,
    wedding: collaborator.wedding,
    role: collaborator.role,
    collaboratorId: collaborator.id,
    access: resolveAllAccess(collaborator.role, collaborator.permissions),
  };
}

export type WorkspacePageContext = Awaited<ReturnType<typeof loadWorkspace>>;

export function canSee(
  access: Record<WorkspaceSection, AccessLevel>,
  section: WorkspaceSection,
): boolean {
  return access[section] !== "NONE";
}

export function canChange(
  access: Record<WorkspaceSection, AccessLevel>,
  section: WorkspaceSection,
): boolean {
  return access[section] === "EDIT";
}
