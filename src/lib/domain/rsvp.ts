import type { AgeGroup, RsvpStatus } from "@/generated/prisma/enums";

/**
 * Guest-list and RSVP tallies. Pure functions over plain rows so the counts can
 * be tested directly and reused by both the dashboard and the guest page.
 */

export type GuestLike = {
  id: string;
  firstName: string;
  lastName: string;
  ageGroup: AgeGroup;
  dietaryRestrictions?: string | null;
  plusOneAllowed: boolean;
  plusOneOfGuestId?: string | null;
  rsvp?: { status: RsvpStatus; mealOptionId: string | null } | null;
};

export type MealOptionLike = { id: string; name: string };

export function statusOf(guest: GuestLike): RsvpStatus {
  return guest.rsvp?.status ?? "PENDING";
}

export type RsvpCounts = {
  /** Every guest row, plus-ones included. */
  totalInvited: number;
  attending: number;
  declined: number;
  maybe: number;
  pending: number;
  /** Anyone who has given any answer at all. */
  responded: number;
  /** Percentage of invitees who have responded. */
  responseRate: number;
  /** Head counts among attending guests, which is what catering bills on. */
  attendingAdults: number;
  attendingChildren: number;
  attendingInfants: number;
  plusOnesAllowed: number;
  plusOnesClaimed: number;
};

export function countRsvps(guests: GuestLike[]): RsvpCounts {
  const counts = {
    attending: 0,
    declined: 0,
    maybe: 0,
    pending: 0,
    attendingAdults: 0,
    attendingChildren: 0,
    attendingInfants: 0,
    plusOnesAllowed: 0,
    plusOnesClaimed: 0,
  };

  for (const guest of guests) {
    const status = statusOf(guest);

    if (status === "ATTENDING") counts.attending += 1;
    else if (status === "DECLINED") counts.declined += 1;
    else if (status === "MAYBE") counts.maybe += 1;
    else counts.pending += 1;

    if (guest.plusOneAllowed) counts.plusOnesAllowed += 1;
    if (guest.plusOneOfGuestId) counts.plusOnesClaimed += 1;

    if (status === "ATTENDING") {
      if (guest.ageGroup === "ADULT") counts.attendingAdults += 1;
      else if (guest.ageGroup === "CHILD") counts.attendingChildren += 1;
      else counts.attendingInfants += 1;
    }
  }

  const totalInvited = guests.length;
  const responded = counts.attending + counts.declined + counts.maybe;

  return {
    ...counts,
    totalInvited,
    responded,
    responseRate:
      totalInvited === 0 ? 0 : Math.round((responded / totalInvited) * 100),
  };
}

export type MealCount = {
  mealOptionId: string | null;
  name: string;
  count: number;
};

/**
 * Meal tallies for the caterer. Only attending guests are counted, and anyone
 * attending without a choice is grouped under "No selection" so the gap is
 * visible rather than silently dropped.
 */
export function countMeals(
  guests: GuestLike[],
  mealOptions: MealOptionLike[],
): MealCount[] {
  const counts = new Map<string | null, number>();
  counts.set(null, 0);
  for (const option of mealOptions) counts.set(option.id, 0);

  for (const guest of guests) {
    if (statusOf(guest) !== "ATTENDING") continue;
    const mealId = guest.rsvp?.mealOptionId ?? null;
    const key = counts.has(mealId) ? mealId : null;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const results: MealCount[] = mealOptions.map((option) => ({
    mealOptionId: option.id,
    name: option.name,
    count: counts.get(option.id) ?? 0,
  }));

  const unselected = counts.get(null) ?? 0;
  if (unselected > 0) {
    results.push({
      mealOptionId: null,
      name: "No selection",
      count: unselected,
    });
  }

  return results;
}

export type DietaryNote = {
  guestId: string;
  guestName: string;
  restriction: string;
};

/** Dietary requirements among attending guests, for the catering brief. */
export function dietaryNotes(guests: GuestLike[]): DietaryNote[] {
  return guests
    .filter(
      (guest) =>
        statusOf(guest) === "ATTENDING" &&
        guest.dietaryRestrictions &&
        guest.dietaryRestrictions.trim() !== "",
    )
    .map((guest) => ({
      guestId: guest.id,
      guestName: `${guest.firstName} ${guest.lastName}`.trim(),
      restriction: (guest.dietaryRestrictions ?? "").trim(),
    }));
}

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  PENDING: "Awaiting reply",
  ATTENDING: "Attending",
  DECLINED: "Declined",
  MAYBE: "Maybe",
};

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  ADULT: "Adult",
  CHILD: "Child",
  INFANT: "Infant",
};
