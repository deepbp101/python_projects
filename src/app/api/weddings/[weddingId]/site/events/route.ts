import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureSite } from "@/lib/services/site";
import { siteEventSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, siteEventSchema);

  const site = await ensureSite(weddingId);
  const event = await prisma.siteEvent.create({
    data: {
      siteId: site.id,
      ...input,
      startsAt: new Date(input.startsAt),
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      sortOrder: input.sortOrder || site.events.length,
    },
  });

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ event }, 201);
});
