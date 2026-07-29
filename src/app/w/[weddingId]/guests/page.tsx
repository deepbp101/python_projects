import type { Metadata } from "next";
import { GuestBoard } from "@/components/guest-board";
import { NoAccess } from "@/components/no-access";
import { prisma } from "@/lib/db";
import { countMeals, countRsvps, dietaryNotes } from "@/lib/domain/rsvp";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import { guestInclude } from "@/lib/services/guests";

export const metadata: Metadata = { title: "Guest list" };

export default async function GuestsPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "GUESTS")) return <NoAccess section="The guest list" />;

  const [guests, households, tags, mealOptions] = await Promise.all([
    prisma.guest.findMany({
      where: { weddingId },
      include: guestInclude,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.household.findMany({ where: { weddingId }, orderBy: { name: "asc" } }),
    prisma.guestTag.findMany({ where: { weddingId }, orderBy: { name: "asc" } }),
    prisma.mealOption.findMany({
      where: { weddingId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <GuestBoard
      weddingId={weddingId}
      canEdit={canChange(access, "GUESTS")}
      counts={countRsvps(guests)}
      meals={countMeals(guests, mealOptions)}
      dietary={dietaryNotes(guests)}
      mealOptions={mealOptions.map((meal) => ({
        id: meal.id,
        name: meal.name,
      }))}
      households={households.map((household) => ({
        id: household.id,
        name: household.name,
      }))}
      tags={tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color }))}
      guests={guests.map((guest) => ({
        id: guest.id,
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        ageGroup: guest.ageGroup,
        dietaryRestrictions: guest.dietaryRestrictions,
        plusOneAllowed: guest.plusOneAllowed,
        plusOneOfGuestId: guest.plusOneOfGuestId,
        householdName: guest.household?.name ?? null,
        tagIds: guest.tags.map((link) => link.tagId),
        rsvp: guest.rsvp
          ? { status: guest.rsvp.status, mealOptionId: guest.rsvp.mealOptionId }
          : null,
      }))}
    />
  );
}
