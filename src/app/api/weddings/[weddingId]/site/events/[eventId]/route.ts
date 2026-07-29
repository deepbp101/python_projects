import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateSiteEventSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; eventId: string }> };

/** Scoped through the site relation so one wedding cannot edit another's events. */
const scoped = (eventId: string, weddingId: string) => ({
  id: eventId,
  site: { weddingId },
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, eventId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, updateSiteEventSchema);

  const existing = await prisma.siteEvent.findFirst({
    where: scoped(eventId, weddingId),
    select: { id: true },
  });
  if (!existing) throw notFound("That event does not exist.");

  const { startsAt, endsAt, ...rest } = input;
  const event = await prisma.siteEvent.update({
    where: { id: eventId },
    data: {
      ...rest,
      ...(startsAt ? { startsAt: new Date(startsAt) } : {}),
      ...(endsAt !== undefined
        ? { endsAt: endsAt ? new Date(endsAt) : null }
        : {}),
    },
  });

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ event });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, eventId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");

  const { count } = await prisma.siteEvent.deleteMany({
    where: scoped(eventId, weddingId),
  });
  if (count === 0) throw notFound("That event does not exist.");

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ ok: true });
});
