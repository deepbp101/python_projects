import {
  badRequest,
  notFound,
  ok,
  parseBody,
  requireWorkspace,
  route,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { guestInclude } from "@/lib/services/guests";
import { updateGuestSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; guestId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, guestId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, updateGuestSchema);

  const existing = await prisma.guest.findFirst({
    where: { id: guestId, weddingId },
  });
  if (!existing) throw notFound("That guest does not exist.");

  if (input.householdId) {
    const household = await prisma.household.findFirst({
      where: { id: input.householdId, weddingId },
      select: { id: true },
    });
    if (!household) throw badRequest("Pick a household from this wedding.");
  }

  const { tagIds, ...guestData } = input;

  const guest = await prisma.guest.update({
    where: { id: guestId },
    data: {
      ...guestData,
      ...(tagIds
        ? { tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) } }
        : {}),
    },
    include: guestInclude,
  });

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ guest });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, guestId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");

  const { count } = await prisma.guest.deleteMany({
    where: { id: guestId, weddingId },
  });
  if (count === 0) throw notFound("That guest does not exist.");

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ ok: true });
});
