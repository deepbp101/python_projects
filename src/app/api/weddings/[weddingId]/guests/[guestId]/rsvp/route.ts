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
import { rsvpSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; guestId: string }> };

export const PUT = route(async (request: Request, { params }: Params) => {
  const { weddingId, guestId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, rsvpSchema);

  const guest = await prisma.guest.findFirst({
    where: { id: guestId, weddingId },
    select: { id: true },
  });
  if (!guest) throw notFound("That guest does not exist.");

  if (input.mealOptionId) {
    const meal = await prisma.mealOption.findFirst({
      where: { id: input.mealOptionId, weddingId },
      select: { id: true },
    });
    if (!meal) throw badRequest("Pick a meal option from this wedding.");
  }

  // Only a real answer stamps respondedAt; moving back to PENDING clears it.
  const respondedAt = input.status === "PENDING" ? null : new Date();

  await prisma.rsvp.upsert({
    where: { guestId },
    create: {
      guestId,
      status: input.status,
      mealOptionId: input.mealOptionId ?? null,
      message: input.message ?? null,
      respondedAt,
    },
    update: {
      status: input.status,
      mealOptionId: input.mealOptionId ?? null,
      message: input.message ?? null,
      respondedAt,
    },
  });

  // Someone who is no longer coming should not keep holding a seat.
  const unseated =
    input.status === "DECLINED" || input.status === "PENDING"
      ? (await prisma.seatAssignment.deleteMany({ where: { guestId } })).count > 0
      : false;

  const updated = await prisma.guest.findUniqueOrThrow({
    where: { id: guestId },
    include: guestInclude,
  });

  broadcastChange(weddingId, "guests", context.user.id);
  if (unseated) broadcastChange(weddingId, "seating", context.user.id);

  return ok({ guest: updated, unseated });
});
