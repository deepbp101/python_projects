import type { RsvpStatus } from "@/generated/prisma/enums";
import { formatTimeInZone } from "@/lib/dates";

/**
 * A guest's personal schedule, assembled from data the couple already maintains:
 * the site's events, that guest's RSVP and meal choice, and their seat.
 *
 * Pure, so the assembly rules are testable without a database — and because the
 * interesting behaviour here is the rules rather than the rendering.
 */

export type ItineraryGuest = {
  firstName: string;
  lastName: string;
  status: RsvpStatus;
  mealName: string | null;
  dietaryRestrictions: string | null;
  tableName: string | null;
  householdName: string | null;
  /** Present when this guest is hosting a plus-one. */
  plusOneName: string | null;
};

export type ItineraryEventInput = {
  id: string;
  name: string;
  startsAt: Date | string;
  endsAt: Date | string | null;
  venueName: string | null;
  address: string | null;
  description: string | null;
  dressCode: string | null;
  mapUrl: string | null;
};

export type ItineraryEvent = ItineraryEventInput & {
  /** Pre-formatted in the wedding's timezone, so the page has no clock logic. */
  timeLabel: string;
};

export type Itinerary = {
  guestName: string;
  /** False for a guest who declined or has not replied — see `buildItinerary`. */
  showSchedule: boolean;
  status: RsvpStatus;
  events: ItineraryEvent[];
  seating: { tableName: string } | null;
  meal: { name: string | null; dietaryRestrictions: string | null } | null;
  plusOneName: string | null;
  householdName: string | null;
};

const byStart = (a: ItineraryEventInput, b: ItineraryEventInput) =>
  new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();

/**
 * Builds one guest's itinerary.
 *
 * A guest who declined, or has not replied yet, does not get a schedule. Sending
 * someone table assignments and arrival times for a wedding they said no to is
 * worse than sending nothing, and for a guest still deciding it reads as
 * presumptuous — they get the date and a nudge to reply instead.
 *
 * Times are formatted here rather than in the page so that the timezone is
 * applied in exactly one place: these are instants, and a ceremony at 4pm local
 * is not 4pm UTC.
 */
export function buildItinerary({
  guest,
  events,
  timezone,
}: {
  guest: ItineraryGuest;
  events: ItineraryEventInput[];
  timezone: string | null | undefined;
}): Itinerary {
  const attending = guest.status === "ATTENDING" || guest.status === "MAYBE";

  return {
    guestName: `${guest.firstName} ${guest.lastName}`.trim(),
    showSchedule: attending,
    status: guest.status,
    events: attending
      ? [...events].sort(byStart).map((event) => ({
          ...event,
          timeLabel: formatEventWindow(event, timezone),
        }))
      : [],
    seating: attending && guest.tableName ? { tableName: guest.tableName } : null,
    meal:
      attending && (guest.mealName || guest.dietaryRestrictions)
        ? {
            name: guest.mealName,
            dietaryRestrictions: guest.dietaryRestrictions,
          }
        : null,
    plusOneName: attending ? guest.plusOneName : null,
    householdName: guest.householdName,
  };
}

/** "4:00 PM" or "4:00 PM – 10:00 PM" when the event has an end. */
export function formatEventWindow(
  event: Pick<ItineraryEventInput, "startsAt" | "endsAt">,
  timezone: string | null | undefined,
): string {
  const start = formatTimeInZone(event.startsAt, timezone);
  if (!event.endsAt) return start;
  return `${start} – ${formatTimeInZone(event.endsAt, timezone)}`;
}
