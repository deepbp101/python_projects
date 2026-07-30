import { describe, expect, it } from "vitest";
import type { RsvpStatus } from "@/generated/prisma/enums";
import {
  buildItinerary,
  formatEventWindow,
  type ItineraryEventInput,
  type ItineraryGuest,
} from "@/lib/domain/itinerary";

const guest = (
  status: RsvpStatus,
  overrides: Partial<ItineraryGuest> = {},
): ItineraryGuest => ({
  firstName: "Jordan",
  lastName: "Ellis",
  status,
  mealName: "Braised short rib",
  dietaryRestrictions: null,
  tableName: "Table 3",
  householdName: "The Ellis Family",
  plusOneName: null,
  ...overrides,
});

const event = (
  id: string,
  startsAt: string,
  endsAt: string | null = null,
): ItineraryEventInput => ({
  id,
  name: id,
  startsAt,
  endsAt,
  venueName: "The Old Mill",
  address: null,
  description: null,
  dressCode: null,
  mapUrl: null,
});

const events = [
  event("Reception", "2027-03-30T23:00:00Z"),
  event("Ceremony", "2027-03-30T20:00:00Z", "2027-03-30T21:00:00Z"),
];

describe("buildItinerary", () => {
  it("gives an attending guest their schedule, table and meal", () => {
    const result = buildItinerary({
      guest: guest("ATTENDING"),
      events,
      timezone: "UTC",
    });

    expect(result.showSchedule).toBe(true);
    expect(result.guestName).toBe("Jordan Ellis");
    expect(result.seating).toEqual({ tableName: "Table 3" });
    expect(result.meal?.name).toBe("Braised short rib");
  });

  it("withholds the schedule from a guest who declined", () => {
    const result = buildItinerary({
      guest: guest("DECLINED"),
      events,
      timezone: "UTC",
    });

    // Sending arrival times and a table number to someone who said no is worse
    // than sending nothing.
    expect(result.showSchedule).toBe(false);
    expect(result.events).toEqual([]);
    expect(result.seating).toBeNull();
    expect(result.meal).toBeNull();
  });

  it("withholds it from a guest who has not replied", () => {
    const result = buildItinerary({
      guest: guest("PENDING"),
      events,
      timezone: "UTC",
    });
    expect(result.showSchedule).toBe(false);
    expect(result.events).toEqual([]);
  });

  it("still shows a maybe their details, since they may yet come", () => {
    const result = buildItinerary({
      guest: guest("MAYBE"),
      events,
      timezone: "UTC",
    });
    expect(result.showSchedule).toBe(true);
    expect(result.events).toHaveLength(2);
  });

  it("orders events by start time regardless of input order", () => {
    const result = buildItinerary({
      guest: guest("ATTENDING"),
      events,
      timezone: "UTC",
    });
    expect(result.events.map((entry) => entry.id)).toEqual([
      "Ceremony",
      "Reception",
    ]);
  });

  it("formats times in the wedding's timezone, not the reader's", () => {
    const utc = buildItinerary({
      guest: guest("ATTENDING"),
      events,
      timezone: "UTC",
    });
    const newYork = buildItinerary({
      guest: guest("ATTENDING"),
      events,
      timezone: "America/New_York",
    });

    expect(utc.events[0].timeLabel).toBe("8:00 PM – 9:00 PM");
    expect(newYork.events[0].timeLabel).toBe("4:00 PM – 5:00 PM");
  });

  it("omits the meal card when there is nothing to say", () => {
    const result = buildItinerary({
      guest: guest("ATTENDING", { mealName: null, dietaryRestrictions: null }),
      events,
      timezone: "UTC",
    });
    expect(result.meal).toBeNull();
  });

  it("keeps dietary notes even without a meal choice", () => {
    const result = buildItinerary({
      guest: guest("ATTENDING", {
        mealName: null,
        dietaryRestrictions: "Shellfish allergy",
      }),
      events,
      timezone: "UTC",
    });
    expect(result.meal).toEqual({
      name: null,
      dietaryRestrictions: "Shellfish allergy",
    });
  });

  it("names the plus-one only for a guest who is coming", () => {
    expect(
      buildItinerary({
        guest: guest("ATTENDING", { plusOneName: "Sam Ortiz" }),
        events,
        timezone: "UTC",
      }).plusOneName,
    ).toBe("Sam Ortiz");

    expect(
      buildItinerary({
        guest: guest("DECLINED", { plusOneName: "Sam Ortiz" }),
        events,
        timezone: "UTC",
      }).plusOneName,
    ).toBeNull();
  });

  it("does not mutate the events it was given", () => {
    const input = [...events];
    buildItinerary({ guest: guest("ATTENDING"), events: input, timezone: "UTC" });
    expect(input[0].id).toBe("Reception");
  });
});

describe("formatEventWindow", () => {
  it("shows a single time when there is no end", () => {
    expect(
      formatEventWindow({ startsAt: "2027-03-30T20:00:00Z", endsAt: null }, "UTC"),
    ).toBe("8:00 PM");
  });

  it("falls back to UTC for a timezone that does not exist", () => {
    // `timezone` is free text on the wedding — a typo must not take the page down.
    expect(
      formatEventWindow(
        { startsAt: "2027-03-30T20:00:00Z", endsAt: null },
        "Not/AZone",
      ),
    ).toBe("8:00 PM");
  });
});
