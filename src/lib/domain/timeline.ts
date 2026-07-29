import type { Milestone, TaskPriority } from "@/generated/prisma/enums";
import { daysBetween, startOfUtcDay, subDays } from "@/lib/dates";

/**
 * The default wedding checklist.
 *
 * Kept as code rather than database rows so timeline generation stays a pure,
 * directly testable function. `offsetDays` is days *before* the wedding, so a
 * negative value means the task is due after the wedding.
 */
export type TaskTemplate = {
  /** Stable identifier; also written to Task.templateKey so regeneration is idempotent. */
  key: string;
  title: string;
  description: string;
  category: string;
  offsetDays: number;
  priority: TaskPriority;
};

export const TASK_CATEGORIES = [
  "Planning",
  "Venue",
  "Vendors",
  "Attire",
  "Guests",
  "Ceremony",
  "Reception",
  "Legal",
  "Honeymoon",
  "Day Of",
] as const;

export const DEFAULT_TASK_CATALOG: TaskTemplate[] = [
  // ---- 12 months out ------------------------------------------------------
  { key: "set-budget", title: "Set your overall budget", description: "Agree on a total number and who is contributing before booking anything.", category: "Planning", offsetDays: 365, priority: "HIGH" },
  { key: "draft-guest-list", title: "Draft a rough guest list", description: "Headcount drives venue size and catering cost, so estimate it early.", category: "Guests", offsetDays: 360, priority: "HIGH" },
  { key: "choose-wedding-party", title: "Choose your wedding party", description: "Ask the people you want standing beside you.", category: "Planning", offsetDays: 350, priority: "MEDIUM" },
  { key: "hire-planner", title: "Decide on a wedding planner", description: "Full-service, month-of coordination, or self-managed.", category: "Vendors", offsetDays: 340, priority: "MEDIUM" },
  { key: "book-venue", title: "Book the ceremony and reception venues", description: "Popular venues book 12-18 months ahead. Confirm the date in writing.", category: "Venue", offsetDays: 330, priority: "HIGH" },
  { key: "research-vendors", title: "Research and shortlist vendors", description: "Collect quotes for photography, catering, music and florals.", category: "Vendors", offsetDays: 320, priority: "MEDIUM" },
  { key: "book-photographer", title: "Book your photographer", description: "Review full galleries, not just highlight reels.", category: "Vendors", offsetDays: 300, priority: "HIGH" },
  { key: "book-caterer", title: "Book the caterer", description: "Confirm whether the venue requires an in-house or approved caterer.", category: "Vendors", offsetDays: 290, priority: "HIGH" },

  // ---- 9 months out -------------------------------------------------------
  { key: "book-music", title: "Book the band or DJ", description: "Ask what their setup needs from the venue for power and space.", category: "Vendors", offsetDays: 260, priority: "HIGH" },
  { key: "shop-wedding-dress", title: "Start shopping for wedding attire", description: "Made-to-order gowns commonly need 6-8 months plus alterations.", category: "Attire", offsetDays: 250, priority: "HIGH" },
  { key: "book-florist", title: "Book the florist", description: "Bring inspiration images and your colour palette.", category: "Vendors", offsetDays: 240, priority: "MEDIUM" },
  { key: "book-officiant", title: "Book your officiant", description: "Check any residency, membership or paperwork requirements.", category: "Ceremony", offsetDays: 220, priority: "HIGH" },
  { key: "create-wedding-website", title: "Build the wedding website", description: "Travel details, schedule, and where to RSVP.", category: "Guests", offsetDays: 210, priority: "MEDIUM" },
  { key: "reserve-hotel-blocks", title: "Reserve hotel room blocks", description: "Lock in rates for out-of-town guests before the season fills up.", category: "Guests", offsetDays: 200, priority: "MEDIUM" },
  { key: "send-save-the-dates", title: "Send save-the-dates", description: "Especially important for destination weddings and holiday weekends.", category: "Guests", offsetDays: 190, priority: "HIGH" },
  { key: "book-videographer", title: "Book a videographer", description: "Optional, but hard to add late. Decide now either way.", category: "Vendors", offsetDays: 185, priority: "LOW" },

  // ---- 6 months out -------------------------------------------------------
  { key: "order-invitations", title: "Order invitations and stationery", description: "Order 15% extra for mistakes and keepsakes.", category: "Guests", offsetDays: 170, priority: "MEDIUM" },
  { key: "plan-honeymoon", title: "Plan the honeymoon", description: "Check passport expiry dates and any visa lead times.", category: "Honeymoon", offsetDays: 165, priority: "MEDIUM" },
  { key: "book-transportation", title: "Arrange transportation", description: "Shuttles between hotel, ceremony and reception.", category: "Venue", offsetDays: 150, priority: "MEDIUM" },
  { key: "choose-party-attire", title: "Choose wedding party attire", description: "Share sizing deadlines with everyone in the party.", category: "Attire", offsetDays: 140, priority: "MEDIUM" },
  { key: "register-gifts", title: "Set up your gift registry", description: "Include a range of price points, and a cash or honeymoon fund if you want one.", category: "Guests", offsetDays: 135, priority: "LOW" },
  { key: "book-cake", title: "Book the cake or dessert", description: "Schedule a tasting and confirm delivery timing.", category: "Vendors", offsetDays: 120, priority: "MEDIUM" },
  { key: "schedule-dress-fitting", title: "Schedule the first fitting", description: "Bring the shoes and undergarments you plan to wear.", category: "Attire", offsetDays: 110, priority: "MEDIUM" },
  { key: "book-hair-makeup", title: "Book hair and makeup artists", description: "Confirm how many people they cover and how long they need.", category: "Vendors", offsetDays: 100, priority: "MEDIUM" },
  { key: "plan-rehearsal-dinner", title: "Plan the rehearsal dinner", description: "Book the venue and confirm who is invited.", category: "Ceremony", offsetDays: 95, priority: "MEDIUM" },

  // ---- 3 months out -------------------------------------------------------
  { key: "finalize-menu", title: "Finalise the menu", description: "Attend the tasting and lock in the meal choices guests can pick from.", category: "Reception", offsetDays: 85, priority: "HIGH" },
  { key: "order-rings", title: "Order wedding rings", description: "Allow time for sizing and engraving.", category: "Ceremony", offsetDays: 80, priority: "HIGH" },
  { key: "mail-invitations", title: "Mail the invitations", description: "Six to eight weeks out, with an RSVP date three to four weeks before.", category: "Guests", offsetDays: 75, priority: "HIGH" },
  { key: "confirm-ceremony-details", title: "Confirm the ceremony structure", description: "Readings, music, processional order and vows.", category: "Ceremony", offsetDays: 70, priority: "MEDIUM" },
  { key: "write-vows", title: "Write your vows", description: "Draft early so you have time to revise and practise reading them aloud.", category: "Ceremony", offsetDays: 60, priority: "MEDIUM" },
  { key: "apply-marriage-license", title: "Apply for the marriage licence", description: "Check the validity window in your jurisdiction — many expire in 30-90 days.", category: "Legal", offsetDays: 45, priority: "HIGH" },
  { key: "final-dress-fitting", title: "Final attire fitting", description: "Last chance for alterations.", category: "Attire", offsetDays: 40, priority: "HIGH" },
  { key: "hair-makeup-trial", title: "Hair and makeup trial", description: "Photograph the result in daylight to see how it reads on camera.", category: "Attire", offsetDays: 35, priority: "LOW" },

  // ---- 1 month out --------------------------------------------------------
  { key: "rsvp-follow-up", title: "Chase outstanding RSVPs", description: "Call the guests who have not replied — a message is easy to miss.", category: "Guests", offsetDays: 25, priority: "HIGH" },
  { key: "confirm-vendor-details", title: "Confirm details with every vendor", description: "Arrival times, contacts, setup needs and final balances.", category: "Vendors", offsetDays: 21, priority: "HIGH" },
  { key: "finalize-seating-chart", title: "Finalise the seating chart", description: "Build it once RSVPs are in, and leave room for late changes.", category: "Reception", offsetDays: 18, priority: "HIGH" },
  { key: "final-headcount", title: "Give the caterer the final headcount", description: "Include vendor meals and dietary restrictions.", category: "Reception", offsetDays: 14, priority: "HIGH" },
  { key: "write-speeches", title: "Write and rehearse speeches", description: "Share the running order with whoever is speaking.", category: "Reception", offsetDays: 14, priority: "MEDIUM" },
  { key: "day-of-timeline", title: "Build the day-of timeline", description: "Send it to the wedding party and every vendor.", category: "Day Of", offsetDays: 10, priority: "HIGH" },
  { key: "pick-up-rings", title: "Pick up the rings", description: "Check the engraving and sizing before you leave the shop.", category: "Ceremony", offsetDays: 10, priority: "MEDIUM" },

  // ---- 1 week out ---------------------------------------------------------
  { key: "final-payments", title: "Settle final vendor payments", description: "Prepare tip envelopes and label them by vendor.", category: "Vendors", offsetDays: 7, priority: "HIGH" },
  { key: "break-in-shoes", title: "Break in your shoes", description: "An hour a day indoors saves the reception.", category: "Attire", offsetDays: 7, priority: "LOW" },
  { key: "pack-honeymoon", title: "Pack for the honeymoon", description: "Travel documents, chargers, and anything that needs to be picked up in advance.", category: "Honeymoon", offsetDays: 5, priority: "MEDIUM" },
  { key: "delegate-day-of-items", title: "Delegate day-of responsibilities", description: "Who carries the rings, the licence, the gifts and the emergency kit.", category: "Day Of", offsetDays: 3, priority: "HIGH" },
  { key: "rehearsal", title: "Ceremony rehearsal", description: "Walk the processional with everyone who is in it.", category: "Ceremony", offsetDays: 2, priority: "HIGH" },

  // ---- Day of -------------------------------------------------------------
  { key: "emergency-kit", title: "Pack the day-of emergency kit", description: "Safety pins, stain remover, plasters, painkillers, snacks, phone charger.", category: "Day Of", offsetDays: 0, priority: "MEDIUM" },
  { key: "hand-off-rings", title: "Hand the rings and licence to your point person", description: "One named person, told twice.", category: "Day Of", offsetDays: 0, priority: "HIGH" },

  // ---- After --------------------------------------------------------------
  { key: "return-rentals", title: "Return rented attire and hire items", description: "Late returns are charged by the day.", category: "Day Of", offsetDays: -3, priority: "MEDIUM" },
  { key: "thank-you-notes", title: "Send thank-you notes", description: "Work through them in batches while you still remember who gave what.", category: "Guests", offsetDays: -14, priority: "MEDIUM" },
  { key: "review-vendors", title: "Review your vendors", description: "Reviews are the main way good wedding vendors get found.", category: "Vendors", offsetDays: -21, priority: "LOW" },
  { key: "preserve-dress", title: "Clean and preserve your attire", description: "Stains set permanently — most specialists want it within a few weeks.", category: "Attire", offsetDays: -30, priority: "LOW" },
  { key: "update-legal-names", title: "Update names and legal documents", description: "Only if either of you is changing names: passport, licence, bank, employer.", category: "Legal", offsetDays: -30, priority: "LOW" },
];

/**
 * Which planning phase an offset belongs to. Derived from `offsetDays` rather
 * than stored per template, so the catalog cannot drift out of sync with the
 * milestone headings shown in the UI.
 */
export function milestoneForOffset(offsetDays: number): Milestone {
  if (offsetDays < 0) return "AFTER";
  if (offsetDays === 0) return "DAY_OF";
  if (offsetDays <= 7) return "ONE_WEEK";
  if (offsetDays <= 30) return "ONE_MONTH";
  if (offsetDays <= 90) return "THREE_MONTHS";
  if (offsetDays <= 180) return "SIX_MONTHS";
  if (offsetDays <= 270) return "NINE_MONTHS";
  return "TWELVE_MONTHS";
}

export const MILESTONE_ORDER: Milestone[] = [
  "TWELVE_MONTHS",
  "NINE_MONTHS",
  "SIX_MONTHS",
  "THREE_MONTHS",
  "ONE_MONTH",
  "ONE_WEEK",
  "DAY_OF",
  "AFTER",
];

export const MILESTONE_LABELS: Record<Milestone, string> = {
  TWELVE_MONTHS: "12+ months out",
  NINE_MONTHS: "9 months out",
  SIX_MONTHS: "6 months out",
  THREE_MONTHS: "3 months out",
  ONE_MONTH: "1 month out",
  ONE_WEEK: "1 week out",
  DAY_OF: "Wedding day",
  AFTER: "After the wedding",
};

export type GeneratedTask = {
  templateKey: string;
  title: string;
  description: string;
  category: string;
  milestone: Milestone;
  priority: TaskPriority;
  dueDate: Date;
  sortOrder: number;
  /**
   * True when the natural due date already sits in the past — a short
   * engagement. The task is pulled forward to today rather than being created
   * pre-overdue, and the UI flags the compressed timeline.
   */
  wasCompressed: boolean;
};

export type GenerateTimelineOptions = {
  now?: Date;
  catalog?: TaskTemplate[];
  /** Template keys the wedding already has; those entries are skipped. */
  existingKeys?: Iterable<string>;
};

/**
 * Builds the default checklist for a wedding date.
 *
 * Pure: same inputs always produce the same output, which is what makes the
 * timeline testable without a database.
 */
export function generateTimeline(
  weddingDate: Date,
  options: GenerateTimelineOptions = {},
): GeneratedTask[] {
  const {
    now = new Date(),
    catalog = DEFAULT_TASK_CATALOG,
    existingKeys,
  } = options;

  const skip = new Set(existingKeys ?? []);
  const today = startOfUtcDay(now);
  const weddingDay = startOfUtcDay(weddingDate);

  const tasks = catalog
    .filter((template) => !skip.has(template.key))
    .map((template) => {
      const naturalDue = subDays(weddingDay, template.offsetDays);
      const wasCompressed = naturalDue.getTime() < today.getTime();
      return {
        templateKey: template.key,
        title: template.title,
        description: template.description,
        category: template.category,
        milestone: milestoneForOffset(template.offsetDays),
        priority: template.priority,
        dueDate: wasCompressed ? today : naturalDue,
        sortOrder: 0,
        wasCompressed,
      } satisfies GeneratedTask;
    });

  // Earliest first; ties broken by the catalog's own phase ordering so a
  // compressed timeline still reads in a sensible sequence.
  tasks.sort((a, b) => {
    const byDate = a.dueDate.getTime() - b.dueDate.getTime();
    if (byDate !== 0) return byDate;
    return (
      MILESTONE_ORDER.indexOf(a.milestone) - MILESTONE_ORDER.indexOf(b.milestone)
    );
  });

  return tasks.map((task, index) => ({ ...task, sortOrder: index }));
}

export type TimelineProgress = {
  total: number;
  completed: number;
  percentComplete: number;
  overdue: number;
  dueThisWeek: number;
};

type ProgressTask = {
  completedAt: Date | string | null;
  dueDate: Date | string | null;
};

/** Headline checklist numbers for the dashboard. */
export function summarizeProgress(
  tasks: ProgressTask[],
  now: Date = new Date(),
): TimelineProgress {
  const today = startOfUtcDay(now);
  let completed = 0;
  let overdue = 0;
  let dueThisWeek = 0;

  for (const task of tasks) {
    if (task.completedAt) {
      completed += 1;
      continue;
    }
    if (!task.dueDate) continue;
    const due = startOfUtcDay(new Date(task.dueDate));
    const daysUntilDue = daysBetween(today, due);
    if (daysUntilDue < 0) overdue += 1;
    else if (daysUntilDue <= 7) dueThisWeek += 1;
  }

  const total = tasks.length;
  return {
    total,
    completed,
    percentComplete: total === 0 ? 0 : Math.round((completed / total) * 100),
    overdue,
    dueThisWeek,
  };
}
