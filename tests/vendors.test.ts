import { describe, expect, it } from "vitest";
import {
  applyRatingFloor,
  priceTierLabel,
  sortDirectory,
  summarizeRatings,
  summarizeShortlist,
  vendorSlugFrom,
  type DirectoryEntry,
} from "@/lib/domain/vendors";

const entry = (
  name: string,
  average: number | null,
  count = average === null ? 0 : 3,
): DirectoryEntry => ({
  id: name,
  name,
  category: "FLORIST",
  city: "Portland",
  priceTier: 2,
  rating: { count, average, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
  onShortlist: false,
});

describe("summarizeRatings", () => {
  it("averages to one decimal and counts the reviews", () => {
    const summary = summarizeRatings([
      { rating: 5 },
      { rating: 4 },
      { rating: 4 },
    ]);

    expect(summary.count).toBe(3);
    expect(summary.average).toBe(4.3);
    expect(summary.distribution[4]).toBe(2);
    expect(summary.distribution[5]).toBe(1);
  });

  it("reports no average for an unreviewed vendor rather than zero", () => {
    expect(summarizeRatings([])).toMatchObject({ count: 0, average: null });
  });

  it("ignores ratings outside 1-5 instead of folding them into the average", () => {
    const summary = summarizeRatings([
      { rating: 4 },
      { rating: 0 },
      { rating: 9 },
    ]);

    expect(summary.count).toBe(1);
    expect(summary.average).toBe(4);
  });
});

describe("sortDirectory", () => {
  it("puts the best rated first", () => {
    const sorted = sortDirectory([entry("Bloom", 4.1), entry("Aster", 4.8)]);
    expect(sorted.map((e) => e.name)).toEqual(["Aster", "Bloom"]);
  });

  it("sorts unrated vendors last, not first", () => {
    const sorted = sortDirectory([
      entry("New Studio", null),
      entry("Established", 3.2),
    ]);
    expect(sorted.map((e) => e.name)).toEqual(["Established", "New Studio"]);
  });

  it("breaks ties by name so the order is stable", () => {
    const sorted = sortDirectory([entry("Zinnia", 4.5), entry("Acacia", 4.5)]);
    expect(sorted.map((e) => e.name)).toEqual(["Acacia", "Zinnia"]);
  });

  it("can sort by review count or name instead", () => {
    const entries = [entry("Few", 5, 1), entry("Many", 4.2, 40)];

    expect(sortDirectory(entries, "REVIEWS").map((e) => e.name)).toEqual([
      "Many",
      "Few",
    ]);
    expect(sortDirectory(entries, "NAME").map((e) => e.name)).toEqual([
      "Few",
      "Many",
    ]);
  });

  it("does not mutate the array it was given", () => {
    const entries = [entry("Bloom", 4.1), entry("Aster", 4.8)];
    sortDirectory(entries);
    expect(entries[0].name).toBe("Bloom");
  });
});

describe("applyRatingFloor", () => {
  it("drops vendors below the floor, including unrated ones", () => {
    const kept = applyRatingFloor(
      [entry("Good", 4.6), entry("Okay", 3.4), entry("New", null)],
      4,
    );
    expect(kept.map((e) => e.name)).toEqual(["Good"]);
  });

  it("keeps everything at floor zero", () => {
    const entries = [entry("Good", 4.6), entry("New", null)];
    expect(applyRatingFloor(entries, 0)).toHaveLength(2);
  });
});

describe("vendorSlugFrom", () => {
  it("includes the city, since two businesses can share a name", () => {
    expect(vendorSlugFrom("Wildflower Studio", "Portland")).toBe(
      "wildflower-studio-portland",
    );
  });

  it("normalises punctuation, ampersands and accents", () => {
    expect(vendorSlugFrom("Rosé & Thorn")).toBe("rose-and-thorn");
    expect(vendorSlugFrom("  Château  Blanc  ")).toBe("chateau-blanc");
  });

  it("never returns an empty slug", () => {
    expect(vendorSlugFrom("!!!")).toBe("vendor");
  });
});

describe("priceTierLabel", () => {
  it("renders 1-4 as dollar signs", () => {
    expect(priceTierLabel(1)).toBe("$");
    expect(priceTierLabel(4)).toBe("$$$$");
  });

  it("reads as unknown for missing or out-of-range tiers", () => {
    expect(priceTierLabel(null)).toBe("—");
    expect(priceTierLabel(0)).toBe("—");
    expect(priceTierLabel(9)).toBe("—");
  });
});

describe("summarizeShortlist", () => {
  it("counts every status, including the ones nobody is at", () => {
    const counts = summarizeShortlist([
      { status: "BOOKED" },
      { status: "BOOKED" },
      { status: "QUOTED" },
    ]);

    expect(counts.BOOKED).toBe(2);
    expect(counts.QUOTED).toBe(1);
    expect(counts.DECLINED).toBe(0);
  });
});
