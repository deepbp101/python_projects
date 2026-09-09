import { badRequest, notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isSeatable } from "@/lib/domain/seating";
import { broadcastChange } from "@/lib/realtime/emit";
import { assignSeatSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Seats a guest, or takes them out of the chart with `tableId: null`.
 *
 * The guest's seat is unique in the database, so moving them between tables is
 * a single upsert and double-booking is impossible even under a race.
 */
export const PUT = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "SEATING", "EDIT");
  const { guestId, tableId } = await parseBody(request, assignSeatSchema);

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, weddingId },
    include: { rsvp: true },
  });
  if (!guest) throw notFound("That guest does not exist.");

  if (tableId === null) {
    await prisma.seatAssignment.deleteMany({ where: { guestId } });
    broadcastChange(weddingId, "seating", context.user.id);
    return ok({ guestId, tableId: null });
  }

  if (!isSeatable(guest)) {
    throw badRequest(
      "Only guests who have accepted (or replied maybe) can be seated.",
    );
  }

  const table = await prisma.seatingTable.findFirst({
    where: { id: tableId, weddingId },
    include: { _count: { select: { assignments: true } } },
  });
  if (!table) throw notFound("That table does not exist.");

  // Re-seating someone already at this table must not read as a new arrival.
  const current = await prisma.seatAssignment.findUnique({ where: { guestId } });
  const movingIn = current?.tableId !== tableId;

  if (movingIn && table._count.assignments >= table.capacity) {
    throw badRequest(`${table.name} is full.`);
  }

  await prisma.seatAssignment.upsert({
    where: { guestId },
    create: { guestId, tableId },
    update: { tableId },
  });

  broadcastChange(weddingId, "seating", context.user.id);
  return ok({ guestId, tableId });
});
