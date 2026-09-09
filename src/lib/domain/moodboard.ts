import type { MoodCategory } from "@/generated/prisma/enums";

/**
 * Mood board vocabulary. Free of database imports so client components can use
 * it without dragging Prisma into the browser bundle.
 */

export const MOOD_CATEGORIES: MoodCategory[] = [
  "ATTIRE",
  "FLORALS",
  "DECOR",
  "VENUE",
  "CAKE",
  "STATIONERY",
  "BEAUTY",
  "OTHER",
];

export const MOOD_CATEGORY_LABELS: Record<MoodCategory, string> = {
  ATTIRE: "Attire",
  FLORALS: "Florals",
  DECOR: "Decor",
  VENUE: "Venue",
  CAKE: "Cake & desserts",
  STATIONERY: "Stationery",
  BEAUTY: "Hair & beauty",
  OTHER: "Everything else",
};
