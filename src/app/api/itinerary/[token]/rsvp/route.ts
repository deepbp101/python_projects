import { badRequest, notFound, ok, parseBody, route } from "@/lib/api";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import { planDefinition } from "@/lib/domain/plans";
import { guardGuestPost } from "@/lib/rate-limit";
import { broadcastChange } from "@/lib/realtime/emit";
import { loadPlan } from "@/lib/services/plan";
import { publicRsvpSchema } from "@/lib/validation";

type Params = { params: Promise<{ token: string }> };

/**
 * A guest replying, from their own link.
 *
 * The token is the credential: it identifies exactly one guest, so nobody has to
 * type a name and nobody can reply on someone else's behalf by guessing one. The
 * guest can set their own status, meal and dietary note, and answer for a plus-one
 * they are hosting — but nothing else about the wedding is reachable from here.
 *
 * Changing an answer is allowed. People's plans change, and a form that only works
 * once just means a phone call to the couple instead.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { token } = await params;
  const input = await parseBody(request, publicRsvpSchema);

  const guest = await prisma.guest.findFirst({
    where: { itineraryTokenHash: hashToken(token) },
    select: {
      id: true,
      weddingId: true,
      firstName: true,
      plusOne: { select: { id: true } },
    },
  });
  if (!guest) throw notFound("This link is no longer available.");

  await guardGuestPost(
    request,
    guest.weddingId,
    planDefinition(await loadPlan(guest.weddingId)).guestPostsPerDay,
  );

  // A meal choice has to be one this wedding actually offers.
  if (input.mealOptionId) {
    const meal = await prisma.mealOption.findFirst({
      where: { id: input.mealOptionId, weddingId: guest.weddingId },
      select: { id: true },
    });
    if (!meal) throw badRequest("That meal isn't on the menu.");
  }

  const respondedAt = new Date();

  await prisma.rsvp.upsert({
    where: { guestId: guest.id },
    create: {
      guestId: guest.id,
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

  if (input.dietaryRestrictions !== undefined) {
    await prisma.guest.update({
      where: { id: guest.id },
      data: { dietaryRestrictions: input.dietaryRestrictions || null },
    });
  }

  // A plus-one is a real guest row, so answering for them is a second RSVP rather
  // than a flag. Only ever the plus-one this guest is hosting.
  if (guest.plusOne && input.plusOneStatus) {
    await prisma.rsvp.upsert({
      where: { guestId: guest.plusOne.id },
      create: {
        guestId: guest.plusOne.id,
        status: input.plusOneStatus,
        mealOptionId: input.plusOneMealOptionId ?? null,
        respondedAt,
      },
      update: {
        status: input.plusOneStatus,
        mealOptionId: input.plusOneMealOptionId ?? null,
        respondedAt,
      },
    });
  }

  // No actor: the couple and everyone helping should see the reply land.
  broadcastChange(guest.weddingId, "guests", null);

  return ok({ status: input.status, name: guest.firstName });
});
