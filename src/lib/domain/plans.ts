import type { Plan } from "@/generated/prisma/enums";

/**
 * What each plan is entitled to.
 *
 * The only thing stored on a wedding is the plan name; every number below is
 * derived from it. Changing an allowance is therefore a code change and takes
 * effect immediately for everyone on that plan — no backfill, no per-wedding
 * override rows to drift out of sync.
 *
 * Pure and free of database imports, so the same table drives the server's
 * enforcement and the upgrade prompts in the UI. If those two disagreed, the app
 * would be offering things it then refuses.
 */

export const PLANS: Plan[] = ["FREE", "PRO"];

/** Counted things. A limit is a ceiling on how many may exist at once. */
export type CountableLimit =
  | "guests"
  | "collaborators"
  | "vendors"
  | "moodBoardItems"
  | "galleryPhotos"
  | "guestBookEntries"
  | "seatingTables"
  | "aiDrafts";

/** Things that are simply on or off. */
export type PlanFeature =
  | "aiWriting"
  | "styleMatchmaker"
  | "vendorThreads"
  | "guestBookRecordings"
  | "venueTours"
  | "moodBoardSharing"
  | "customTimeline";

export type PlanDefinition = {
  label: string;
  /** One line for the upgrade panel. Not a price — billing is not built yet. */
  blurb: string;
  limits: Record<CountableLimit, number>;
  features: Record<PlanFeature, boolean>;
  /**
   * Model tokens per calendar month, counted as input + output actually reported
   * by the API. Zero means the assistant is off for this plan.
   */
  aiTokensPerMonth: number;
  /** Ceiling on a single generation, so one request cannot eat the month. */
  aiMaxOutputTokens: number;
  /** Anonymous guest posts per wedding per day, across gallery and guest book. */
  guestPostsPerDay: number;
};

/** Used for anything a plan does not cap. */
export const UNLIMITED = Number.POSITIVE_INFINITY;

/**
 * Free is a real, usable product — a couple can plan a whole small wedding on it.
 * What it does not get is the expensive surface: model tokens, unlimited guest
 * uploads, and the vendor and tour features that cost storage and support.
 */
export const PLAN_DEFINITIONS: Record<Plan, PlanDefinition> = {
  FREE: {
    label: "Free",
    blurb: "Everything you need to plan a small wedding, with the extras capped.",
    limits: {
      guests: 40,
      collaborators: 2,
      vendors: 5,
      moodBoardItems: 20,
      galleryPhotos: 50,
      guestBookEntries: 25,
      seatingTables: 8,
      aiDrafts: 5,
    },
    features: {
      aiWriting: true,
      styleMatchmaker: true,
      vendorThreads: false,
      guestBookRecordings: false,
      venueTours: false,
      moodBoardSharing: true,
      customTimeline: false,
    },
    aiTokensPerMonth: 30_000,
    aiMaxOutputTokens: 1_024,
    guestPostsPerDay: 100,
  },
  PRO: {
    label: "Pro",
    blurb: "Everything, uncapped, for the whole planning year.",
    limits: {
      guests: UNLIMITED,
      collaborators: UNLIMITED,
      vendors: UNLIMITED,
      moodBoardItems: UNLIMITED,
      galleryPhotos: UNLIMITED,
      guestBookEntries: UNLIMITED,
      seatingTables: UNLIMITED,
      aiDrafts: UNLIMITED,
    },
    features: {
      aiWriting: true,
      styleMatchmaker: true,
      vendorThreads: true,
      guestBookRecordings: true,
      venueTours: true,
      moodBoardSharing: true,
      customTimeline: true,
    },
    aiTokensPerMonth: 500_000,
    aiMaxOutputTokens: 4_096,
    guestPostsPerDay: 2_000,
  },
};

export function planDefinition(plan: Plan): PlanDefinition {
  return PLAN_DEFINITIONS[plan];
}

export function limitFor(plan: Plan, limit: CountableLimit): number {
  return PLAN_DEFINITIONS[plan].limits[limit];
}

export function hasFeature(plan: Plan, feature: PlanFeature): boolean {
  return PLAN_DEFINITIONS[plan].features[feature];
}

/**
 * Whether one more of something fits.
 *
 * Takes the count *before* the addition and the number being added, so a bulk
 * import of 30 guests into a 40-guest plan with 20 already there is refused as a
 * whole rather than half-applied.
 */
export function fitsWithinLimit(
  plan: Plan,
  limit: CountableLimit,
  current: number,
  adding = 1,
): boolean {
  return current + adding <= limitFor(plan, limit);
}

export function remainingOf(
  plan: Plan,
  limit: CountableLimit,
  current: number,
): number {
  const max = limitFor(plan, limit);
  if (max === UNLIMITED) return UNLIMITED;
  return Math.max(0, max - current);
}

/** `Infinity` reads badly in a sentence; "unlimited" does not. */
export function describeLimit(value: number): string {
  return value === UNLIMITED ? "unlimited" : value.toLocaleString("en-US");
}

/**
 * The message shown when a limit bites.
 *
 * Says what was hit and what the next plan gives, because "limit reached" with no
 * number is the most annoying possible version of this.
 */
export function limitMessage(
  plan: Plan,
  limit: CountableLimit,
  noun: string,
): string {
  const current = describeLimit(limitFor(plan, limit));
  const upgraded = describeLimit(limitFor("PRO", limit));

  if (plan === "PRO") {
    return `That would go past the ${current} ${noun} limit on Pro. Get in touch and we'll sort it.`;
  }
  return `Free covers ${current} ${noun}. Pro raises that to ${upgraded}.`;
}

export function featureMessage(feature: PlanFeature): string {
  const labels: Record<PlanFeature, string> = {
    aiWriting: "The writing assistant",
    styleMatchmaker: "The style matchmaker",
    vendorThreads: "Messaging vendors",
    guestBookRecordings: "Voice and video guest book entries",
    venueTours: "Virtual venue tours",
    moodBoardSharing: "Sharing your mood board",
    customTimeline: "Editing the timeline templates",
  };
  return `${labels[feature]} is a Pro feature.`;
}

export type UsageWindow = {
  /** `YYYY-MM`, UTC. */
  period: string;
  used: number;
  allowance: number;
};

/** The calendar month a moment falls in, in UTC — the meter's bucket key. */
export function usagePeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function tokensRemaining(plan: Plan, used: number): number {
  return Math.max(0, PLAN_DEFINITIONS[plan].aiTokensPerMonth - used);
}

/**
 * The output ceiling for one request: the plan's cap, or what is left of the
 * month if that is smaller.
 *
 * Returning the remainder rather than refusing outright means the last request of
 * the month produces something short instead of nothing — but never less than a
 * usable minimum, since a two-token answer helps nobody.
 */
export const MIN_USEFUL_OUTPUT_TOKENS = 256;

export function outputTokenBudget(
  plan: Plan,
  used: number,
  requested: number,
): number {
  const remaining = tokensRemaining(plan, used);
  const ceiling = Math.min(requested, PLAN_DEFINITIONS[plan].aiMaxOutputTokens);
  return Math.min(ceiling, Math.max(remaining, 0));
}

export function canGenerate(plan: Plan, used: number): boolean {
  if (!hasFeature(plan, "aiWriting")) return false;
  return tokensRemaining(plan, used) >= MIN_USEFUL_OUTPUT_TOKENS;
}
