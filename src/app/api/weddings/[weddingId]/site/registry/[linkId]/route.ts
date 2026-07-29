import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateRegistryLinkSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; linkId: string }> };

const scoped = (linkId: string, weddingId: string) => ({
  id: linkId,
  site: { weddingId },
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, linkId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, updateRegistryLinkSchema);

  const existing = await prisma.registryLink.findFirst({
    where: scoped(linkId, weddingId),
    select: { id: true },
  });
  if (!existing) throw notFound("That registry link does not exist.");

  const link = await prisma.registryLink.update({
    where: { id: linkId },
    data: input,
  });

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ link });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, linkId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");

  const { count } = await prisma.registryLink.deleteMany({
    where: scoped(linkId, weddingId),
  });
  if (count === 0) throw notFound("That registry link does not exist.");

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ ok: true });
});
