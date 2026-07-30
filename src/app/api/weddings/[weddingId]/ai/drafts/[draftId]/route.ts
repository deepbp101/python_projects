import { notFound, ok, requireWorkspaceOwner, route } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ weddingId: string; draftId: string }> };

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, draftId } = await params;
  await requireWorkspaceOwner(weddingId);

  const draft = await prisma.aiDraft.findFirst({
    where: { id: draftId, weddingId },
    select: { id: true },
  });
  if (!draft) throw notFound("That draft does not exist.");

  await prisma.aiDraft.delete({ where: { id: draft.id } });
  return ok({ removed: true });
});
