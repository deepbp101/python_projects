import { describe, expect, it } from "vitest";
import type { RsvpStatus } from "@/generated/prisma/enums";
import type { GuestLike } from "@/lib/domain/rsvp";
import {
  clampPosition,
  isSeatable,
  occupancyFor,
  suggestTables,
  summarizeSeating,
  type SeatingTableLike,
} from "@/lib/domain/seating";

const guest = (id: string, status: RsvpStatus): GuestLike => ({
  id,
  firstName: id,
  lastName: "Guest",
  ageGroup: "ADULT",
  plusOneAllowed: false,
  rsvp: { status, mealOptionId: null },
});

const table = (
  id: string,
  capacity: number,
  overrides: Partial<SeatingTableLike> = {},
): SeatingTableLike => ({
  id,
  name: id,
  shape: "ROUND",
  capacity,
  x: 50,
  y: 50,
  ...overrides,
});

describe("isSeatable", () => {
  it("allows guests who have accepted or replied maybe", () => {
    expect(isSeatable(guest("a", "ATTENDING"))).toBe(true);
    expect(isSeatable(guest("b", "MAYBE"))).toBe(true);
  });

  it("excludes guests who declined or have not replied", () => {
    expect(isSeatable(guest("c", "DECLINED"))).toBe(false);
    expect(isSeatable(guest("d", "PENDING"))).toBe(false);
  });
});

describe("occupancyFor", () => {
  const assignments = [
    { guestId: "a", tableId: "t1" },
    { guestId: "b", tableId: "t1" },
    { guestId: "c", tableId: "t2" },
  ];

  it("counts only the guests at that table", () => {
    const occupancy = occupancyFor(table("t1", 8), assignments);

    expect(occupancy.seated).toBe(2);
    expect(occupancy.seatsLeft).toBe(6);
    expect(occupancy.guestIds).toEqual(["a", "b"]);
    expect(occupancy.isFull).toBe(false);
    expect(occupancy.isOverCapacity).toBe(false);
  });

  it("marks a table as full at exactly capacity", () => {
    const occupancy = occupancyFor(table("t1", 2), assignments);

    expect(occupancy.isFull).toBe(true);
    expect(occupancy.isOverCapacity).toBe(false);
    expect(occupancy.seatsLeft).toBe(0);
  });

  it("flags over-capacity and never reports negative seats left", () => {
    const occupancy = occupancyFor(table("t1", 1), assignments);

    expect(occupancy.isOverCapacity).toBe(true);
    expect(occupancy.seatsLeft).toBe(0);
  });
});

describe("summarizeSeating", () => {
  const tables = [table("t1", 4), table("t2", 4)];
  const guests = [
    guest("a", "ATTENDING"),
    guest("b", "ATTENDING"),
    guest("c", "MAYBE"),
    guest("d", "DECLINED"),
    guest("e", "PENDING"),
    guest("f", "PENDING"),
  ];

  it("counts seated against seatable guests, not the whole list", () => {
    const summary = summarizeSeating(
      tables,
      [
        { guestId: "a", tableId: "t1" },
        { guestId: "b", tableId: "t1" },
      ],
      guests,
    );

    expect(summary.seated).toBe(2);
    // a, b and c are seatable; two are seated.
    expect(summary.unseated).toBe(1);
    expect(summary.totalCapacity).toBe(8);
    expect(summary.seatsAvailable).toBe(6);
    expect(summary.awaitingRsvp).toBe(2);
  });

  it("ignores an assignment left behind by a guest who declined", () => {
    const summary = summarizeSeating(
      tables,
      [
        { guestId: "a", tableId: "t1" },
        { guestId: "d", tableId: "t1" }, // declined
      ],
      guests,
    );

    expect(summary.seated).toBe(1);
    expect(summary.tables[0].seated).toBe(1);
  });

  it("warns when there are more guests than seats", () => {
    const small = [table("t1", 1)];
    const summary = summarizeSeating(small, [], guests);

    expect(summary.needsMoreSeats).toBe(true);
    expect(summary.seatsAvailable).toBe(1);
  });

  it("does not warn when seats exactly match the guests", () => {
    const summary = summarizeSeating([table("t1", 3)], [], guests);
    expect(summary.needsMoreSeats).toBe(false);
  });

  it("reports which tables are over capacity", () => {
    const summary = summarizeSeating(
      [table("t1", 1)],
      [
        { guestId: "a", tableId: "t1" },
        { guestId: "b", tableId: "t1" },
      ],
      guests,
    );

    expect(summary.overCapacityTables).toEqual(["t1"]);
  });

  it("handles an empty chart", () => {
    const summary = summarizeSeating([], [], []);

    expect(summary.tableCount).toBe(0);
    expect(summary.seated).toBe(0);
    expect(summary.unseated).toBe(0);
    expect(summary.needsMoreSeats).toBe(false);
  });
});

describe("clampPosition", () => {
  it("keeps tables inside the canvas", () => {
    expect(clampPosition(-20, 140)).toEqual({ x: 0, y: 100 });
    expect(clampPosition(33.333, 66.666)).toEqual({ x: 33.33, y: 66.67 });
  });

  it("falls back to the centre for values that are not numbers", () => {
    expect(clampPosition(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      x: 50,
      y: 50,
    });
  });
});

describe("suggestTables", () => {
  it("always starts with a head table", () => {
    const [first] = suggestTables(0);
    expect(first.shape).toBe("HEAD");
  });

  it("adds enough tables to seat everyone", () => {
    const tables = suggestTables(50, { perTable: 8 });
    const seats = tables.reduce((sum, table) => sum + table.capacity, 0);

    expect(seats).toBeGreaterThanOrEqual(50);
  });

  it("needs no extra tables when the head table is enough", () => {
    expect(suggestTables(8, { perTable: 8 })).toHaveLength(1);
  });

  it("lays every table out inside the canvas", () => {
    for (const table of suggestTables(60)) {
      expect(table.x).toBeGreaterThanOrEqual(0);
      expect(table.x).toBeLessThanOrEqual(100);
      expect(table.y).toBeGreaterThanOrEqual(0);
      expect(table.y).toBeLessThanOrEqual(100);
    }
  });

  it("gives every table a distinct name", () => {
    const names = suggestTables(40).map((table) => table.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
