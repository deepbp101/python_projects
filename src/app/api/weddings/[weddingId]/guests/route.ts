import { badRequest, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { countMeals, countRsvps, dietaryNotes } from "@/lib/domain/rsvp";
import { broadcastChange } from "@/lib/realtime/emit";
import { guestInclude } from "@/lib/services/guests";
import { createGuestSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "GUESTS", "VIEW");

  const [guests, households, tags, mealOptions] = await Promise.all([
    prisma.guest.findMany({
      where: { weddingId },
      include: guestInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.household.findMany({
      where: { weddingId },
      orderBy: { name: "asc" },
    }),
    prisma.guestTag.findMany({
      where: { weddingId },
      orderBy: { name: "asc" },
    }),
    prisma.mealOption.findMany({
      where: { weddingId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return ok({
    guests,
    households,
    tags,
    mealOptions,
    counts: countRsvps(guests),
    meals: countMeals(guests, mealOptions),
    dietary: dietaryNotes(guests),
  });
});

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, createGuestSchema);

  if (input.householdId) {
    const household = await prisma.household.findFirst({
      where: { id: input.householdId, weddingId },
      select: { id: true },
    });
    if (!household) throw badRequest("Pick a household from this wedding.");
  }

  const { tagIds, ...guestData } = input;

  const guest = await prisma.guest.create({
    data: {
      weddingId,
      ...guestData,
      // Every guest starts with an RSVP row, so counts never have to guess.
      rsvp: { create: { status: "PENDING" } },
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    include: guestInclude,
  });

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ guest }, 201);
});
