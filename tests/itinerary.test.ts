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

describe("day headings on the schedule", () => {
  // Ceremony and dinner on the wedding day; brunch the next morning. Without a
  // heading the brunch reads as "10:30 AM" below "5:30 PM" — as if it came first.
  const ceremony = event("Ceremony", "2027-03-31T19:00:00Z");
  const dinner = event("Dinner", "2027-03-31T21:30:00Z");
  const brunch = event("Brunch", "2027-04-01T14:30:00Z");

  const build = (events: ItineraryEventInput[], timezone = "America/New_York") =>
    buildItinerary({ guest: guest("ATTENDING"), events, timezone });

  it("labels nothing when the whole schedule is one day", () => {
    const result = build([ceremony, dinner]);
    expect(result.events.map((entry) => entry.dayLabel)).toEqual([null, null]);
  });

  it("labels each day once when the schedule crosses midnight", () => {
    const result = build([ceremony, dinner, brunch]);
    expect(result.events.map((entry) => entry.dayLabel)).toEqual([
      "Wednesday, March 31, 2027",
      null,
      "Thursday, April 1, 2027",
    ]);
  });

  it("groups by the wedding's day, not UTC's", () => {
    // 9:30pm in New York on the 31st is 01:30 UTC on the 1st. Grouping on UTC
    // would put dinner on its own day and split one evening in two.
    const lateDinner = event("Dinner", "2027-04-01T01:30:00Z");

    const newYork = build([ceremony, lateDinner]);
    expect(newYork.events.map((entry) => entry.dayLabel)).toEqual([null, null]);

    // Read as UTC, the same two instants genuinely are different days.
    const utc = build([ceremony, lateDinner], "UTC");
    expect(utc.events.map((entry) => entry.dayLabel)).toEqual([
      "Wednesday, March 31, 2027",
      "Thursday, April 1, 2027",
    ]);
  });

  it("labels the first event of a day even when input order is scrambled", () => {
    const result = build([brunch, dinner, ceremony]);
    expect(result.events.map((entry) => entry.id)).toEqual([
      "Ceremony",
      "Dinner",
      "Brunch",
    ]);
    expect(result.events[0].dayLabel).toBe("Wednesday, March 31, 2027");
    expect(result.events[2].dayLabel).toBe("Thursday, April 1, 2027");
  });

  it("gives a guest with no schedule nothing to label", () => {
    const declined = buildItinerary({
      guest: guest("DECLINED"),
      events: [ceremony, brunch],
      timezone: "America/New_York",
    });
    expect(declined.events).toEqual([]);
  });
});
