import type { VendorCategory, VendorStatus } from "@/generated/prisma/enums";

/**
 * Vendor vocabulary and rating maths. No database imports, so client components
 * and tests can both use it — see the domain-layer note in the README.
 */

export const VENDOR_CATEGORIES: VendorCategory[] = [
  "VENUE",
  "CATERING",
  "PHOTOGRAPHY",
  "VIDEOGRAPHY",
  "FLORIST",
  "MUSIC",
  "CAKE",
  "ATTIRE",
  "BEAUTY",
  "STATIONERY",
  "RENTALS",
  "TRANSPORT",
  "OFFICIANT",
  "PLANNING",
  "OTHER",
];

export const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  VENUE: "Venue",
  CATERING: "Catering & bar",
  PHOTOGRAPHY: "Photography",
  VIDEOGRAPHY: "Videography",
  FLORIST: "Flowers",
  MUSIC: "Music & entertainment",
  CAKE: "Cake & desserts",
  ATTIRE: "Attire & rings",
  BEAUTY: "Hair & beauty",
  STATIONERY: "Stationery",
  RENTALS: "Rentals & decor",
  TRANSPORT: "Transport",
  OFFICIANT: "Officiant",
  PLANNING: "Planning & coordination",
  OTHER: "Everything else",
};

export const VENDOR_STATUSES: VendorStatus[] = [
  "CONSIDERING",
  "CONTACTED",
  "QUOTED",
  "BOOKED",
  "DECLINED",
];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  CONSIDERING: "Considering",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  BOOKED: "Booked",
  DECLINED: "Not going ahead",
};

/** Badge colour per status, so a booked vendor reads differently at a glance. */
export const VENDOR_STATUS_TONES: Record<
  VendorStatus,
  "neutral" | "clay" | "sage" | "alert" | "rose"
> = {
  CONSIDERING: "neutral",
  CONTACTED: "clay",
  QUOTED: "alert",
  BOOKED: "sage",
  DECLINED: "rose",
};

/** The statuses that mean this vendor is part of the wedding. */
export const COMMITTED_STATUSES: VendorStatus[] = ["BOOKED"];

/** 1-4 as the familiar $ to $$$$ band; anything else reads as unknown. */
export function priceTierLabel(tier: number | null | undefined): string {
  if (!tier || tier < 1 || tier > 4) return "—";
  return "$".repeat(Math.round(tier));
}

/**
 * URL-safe identifier for a vendor, from its name and city.
 *
 * Two florists really can share a name in different cities, so the city is part
 * of the slug. Collisions beyond that are resolved by the caller appending a
 * counter, since only the database knows what is already taken.
 */
export function vendorSlugFrom(name: string, city?: string | null): string {
  const normalise = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const parts = [normalise(name), city ? normalise(city) : ""].filter(Boolean);
  return parts.join("-").slice(0, 60).replace(/-+$/g, "") || "vendor";
}

export type RatingSummary = {
  count: number;
  /** Null rather than 0 when nobody has reviewed — an unrated vendor is not a bad one. */
  average: number | null;
  /** Stars 1-5 to number of reviews, for the distribution bars on a profile. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

/**
 * Averages a vendor's reviews, rounded to one decimal.
 *
 * Ratings outside 1-5 are ignored rather than clamped: a value that far out is a
 * bug or bad data, and quietly folding it into the average hides it.
 */
export function summarizeRatings(
  reviews: { rating: number }[],
): RatingSummary {
  const distribution: RatingSummary["distribution"] = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let total = 0;
  let count = 0;

  for (const review of reviews) {
    const stars = Math.round(review.rating);
    if (stars < 1 || stars > 5) continue;
    distribution[stars as 1 | 2 | 3 | 4 | 5] += 1;
    total += stars;
    count += 1;
  }

  return {
    count,
    average: count === 0 ? null : Math.round((total / count) * 10) / 10,
    distribution,
  };
}

export type DirectoryEntry = {
  id: string;
  name: string;
  category: VendorCategory;
  city: string | null;
  priceTier: number | null;
  rating: RatingSummary;
  /** True when this wedding already has the vendor on its shortlist. */
  onShortlist: boolean;
};

export type DirectorySort = "RATING" | "NAME" | "REVIEWS";

/**
 * Orders directory results.
 *
 * Unrated vendors sort last under RATING rather than first: a new listing with
 * no reviews should not outrank a well-reviewed one, and treating "no reviews"
 * as zero stars would be just as wrong in the other direction.
 */
export function sortDirectory(
  entries: DirectoryEntry[],
  sort: DirectorySort = "RATING",
): DirectoryEntry[] {
  const byName = (a: DirectoryEntry, b: DirectoryEntry) =>
    a.name.localeCompare(b.name);

  return [...entries].sort((a, b) => {
    if (sort === "NAME") return byName(a, b);
    if (sort === "REVIEWS") {
      return b.rating.count - a.rating.count || byName(a, b);
    }
    if (a.rating.average === null && b.rating.average === null) {
      return byName(a, b);
    }
    if (a.rating.average === null) return 1;
    if (b.rating.average === null) return -1;
    return b.rating.average - a.rating.average || byName(a, b);
  });
}

/** Drops results below a star floor, keeping unrated vendors only at floor 0. */
export function applyRatingFloor(
  entries: DirectoryEntry[],
  minRating: number,
): DirectoryEntry[] {
  if (minRating <= 0) return entries;
  return entries.filter(
    (entry) => entry.rating.average !== null && entry.rating.average >= minRating,
  );
}

/** Counts each status across a shortlist, for the summary strip. */
export function summarizeShortlist(
  vendors: { status: VendorStatus }[],
): Record<VendorStatus, number> {
  const counts = Object.fromEntries(
    VENDOR_STATUSES.map((status) => [status, 0]),
  ) as Record<VendorStatus, number>;

  for (const vendor of vendors) counts[vendor.status] += 1;
  return counts;
}
