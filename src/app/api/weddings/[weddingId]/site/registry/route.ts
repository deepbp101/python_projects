import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureSite } from "@/lib/services/site";
import { registryLinkSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, registryLinkSchema);

  const site = await ensureSite(weddingId);
  const link = await prisma.registryLink.create({
    data: {
      siteId: site.id,
      ...input,
      sortOrder: input.sortOrder || site.registry.length,
    },
  });

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ link }, 201);
});
