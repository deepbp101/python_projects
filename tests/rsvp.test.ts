import { describe, expect, it } from "vitest";
import {
  countMeals,
  countRsvps,
  dietaryNotes,
  statusOf,
  type GuestLike,
} from "@/lib/domain/rsvp";

const guest = (
  id: string,
  overrides: Partial<GuestLike> = {},
): GuestLike => ({
  id,
  firstName: id,
  lastName: "Guest",
  ageGroup: "ADULT",
  plusOneAllowed: false,
  rsvp: null,
  ...overrides,
});

const MEALS = [
  { id: "chicken", name: "Chicken" },
  { id: "fish", name: "Fish" },
];

describe("statusOf", () => {
  it("treats a guest with no RSVP row as pending", () => {
    expect(statusOf(guest("a"))).toBe("PENDING");
    expect(
      statusOf(guest("b", { rsvp: { status: "ATTENDING", mealOptionId: null } })),
    ).toBe("ATTENDING");
  });
});

describe("countRsvps", () => {
  const guests = [
    guest("a", { rsvp: { status: "ATTENDING", mealOptionId: "chicken" } }),
    guest("b", { rsvp: { status: "ATTENDING", mealOptionId: "fish" } }),
    guest("c", { rsvp: { status: "DECLINED", mealOptionId: null } }),
    guest("d", { rsvp: { status: "MAYBE", mealOptionId: null } }),
    guest("e"),
    guest("f", { rsvp: { status: "PENDING", mealOptionId: null } }),
  ];

  it("tallies every status", () => {
    const counts = countRsvps(guests);

    expect(counts.totalInvited).toBe(6);
    expect(counts.attending).toBe(2);
    expect(counts.declined).toBe(1);
    expect(counts.maybe).toBe(1);
    expect(counts.pending).toBe(2);
  });

  it("counts a maybe as a response for the response rate", () => {
    const counts = countRsvps(guests);

    expect(counts.responded).toBe(4);
    expect(counts.responseRate).toBe(67);
  });

  it("breaks attending guests down by age group", () => {
    const counts = countRsvps([
      guest("adult", { rsvp: { status: "ATTENDING", mealOptionId: null } }),
      guest("child", {
        ageGroup: "CHILD",
        rsvp: { status: "ATTENDING", mealOptionId: null },
      }),
      guest("baby", {
        ageGroup: "INFANT",
        rsvp: { status: "ATTENDING", mealOptionId: null },
      }),
      // Declined guests must not reach the catering headcount.
      guest("absent", {
        ageGroup: "CHILD",
        rsvp: { status: "DECLINED", mealOptionId: null },
      }),
    ]);

    expect(counts.attendingAdults).toBe(1);
    expect(counts.attendingChildren).toBe(1);
    expect(counts.attendingInfants).toBe(1);
  });

  it("tracks plus-ones offered against plus-ones claimed", () => {
    const counts = countRsvps([
      guest("host", { plusOneAllowed: true }),
      guest("other", { plusOneAllowed: true }),
      guest("theirGuest", { plusOneOfGuestId: "host" }),
    ]);

    expect(counts.plusOnesAllowed).toBe(2);
    expect(counts.plusOnesClaimed).toBe(1);
  });

  it("returns zeroes for an empty guest list", () => {
    const counts = countRsvps([]);

    expect(counts.totalInvited).toBe(0);
    expect(counts.responseRate).toBe(0);
    expect(counts.attending).toBe(0);
  });
});

describe("countMeals", () => {
  it("counts choices among attending guests only", () => {
    const counts = countMeals(
      [
        guest("a", { rsvp: { status: "ATTENDING", mealOptionId: "chicken" } }),
        guest("b", { rsvp: { status: "ATTENDING", mealOptionId: "chicken" } }),
        guest("c", { rsvp: { status: "ATTENDING", mealOptionId: "fish" } }),
        guest("d", { rsvp: { status: "DECLINED", mealOptionId: "fish" } }),
        guest("e", { rsvp: { status: "MAYBE", mealOptionId: "chicken" } }),
      ],
      MEALS,
    );

    expect(counts).toEqual([
      { mealOptionId: "chicken", name: "Chicken", count: 2 },
      { mealOptionId: "fish", name: "Fish", count: 1 },
    ]);
  });

  it("surfaces attending guests who have not chosen a meal", () => {
    const counts = countMeals(
      [
        guest("a", { rsvp: { status: "ATTENDING", mealOptionId: "chicken" } }),
        guest("b", { rsvp: { status: "ATTENDING", mealOptionId: null } }),
        guest("c", { rsvp: { status: "ATTENDING", mealOptionId: null } }),
      ],
      MEALS,
    );

    expect(counts.at(-1)).toEqual({
      mealOptionId: null,
      name: "No selection",
      count: 2,
    });
  });

  it("groups a stale meal id under 'no selection' rather than dropping it", () => {
    const counts = countMeals(
      [guest("a", { rsvp: { status: "ATTENDING", mealOptionId: "deleted" } })],
      MEALS,
    );

    const total = counts.reduce((sum, entry) => sum + entry.count, 0);
    expect(total).toBe(1);
    expect(counts.at(-1)?.name).toBe("No selection");
  });

  it("lists every option even when nobody has chosen it", () => {
    const counts = countMeals([], MEALS);
    expect(counts).toEqual([
      { mealOptionId: "chicken", name: "Chicken", count: 0 },
      { mealOptionId: "fish", name: "Fish", count: 0 },
    ]);
  });
});

describe("dietaryNotes", () => {
  it("collects restrictions for attending guests", () => {
    const notes = dietaryNotes([
      guest("a", {
        firstName: "Fiona",
        lastName: "Sullivan",
        dietaryRestrictions: "Vegan",
        rsvp: { status: "ATTENDING", mealOptionId: null },
      }),
      guest("b", {
        dietaryRestrictions: "Gluten free",
        rsvp: { status: "DECLINED", mealOptionId: null },
      }),
      guest("c", { rsvp: { status: "ATTENDING", mealOptionId: null } }),
      guest("d", {
        dietaryRestrictions: "   ",
        rsvp: { status: "ATTENDING", mealOptionId: null },
      }),
    ]);

    expect(notes).toEqual([
      { guestId: "a", guestName: "Fiona Sullivan", restriction: "Vegan" },
    ]);
  });
});
