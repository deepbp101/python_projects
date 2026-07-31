import { z } from "zod";
import {
  MAX_CAPTION,
  MAX_GUEST_MESSAGE,
  MAX_GUEST_NAME,
} from "@/lib/domain/contributions";
import { MAX_MESSAGE_LENGTH } from "@/lib/domain/messaging";

/**
 * Request schemas. Every route handler parses its body through one of these,
 * so nothing untrusted reaches Prisma.
 */

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

/** Money always arrives as integer cents. */
const cents = z.number().int().min(0).max(1_000_000_000);

/** Database identifier. Deliberately format-agnostic so the schema does not
 *  break if the id generator ever changes. */
const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

const isoDate = z.iso.datetime({ offset: true }).or(z.iso.date());
const nullableDate = isoDate.nullable().optional();

/**
 * Builds the PATCH counterpart of a create schema.
 *
 * `.partial()` alone is a trap: it makes keys optional but Zod still applies
 * each field's `.default()` when the key is absent, so a PATCH that sends one
 * field silently resets every other defaulted field. Dragging a table would
 * reset its capacity; renaming a budget category would zero its budget.
 * Stripping the defaults first means an omitted field stays omitted, and the
 * route leaves the stored value alone.
 */
function partialForUpdate<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  const withoutDefaults = Object.fromEntries(
    Object.entries(schema.shape).map(([key, field]) => [
      key,
      field instanceof z.ZodDefault ? field.unwrap() : field,
    ]),
  ) as T;
  return z.object(withoutDefaults).partial();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signupSchema = z.object({
  name: trimmed(120),
  email: z.email().max(255).toLowerCase(),
  password: z
    .string()
    .min(10, "Use at least 10 characters.")
    .max(200, "That password is too long."),
});

export const loginSchema = z.object({
  email: z.email().max(255).toLowerCase(),
  password: z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export const createWeddingSchema = z.object({
  title: trimmed(160),
  weddingDate: isoDate,
  venueName: optionalText(160),
  location: optionalText(160),
  timezone: z.string().trim().max(64).default("UTC"),
  currency: z.string().trim().length(3).default("USD"),
  totalBudget: cents.default(0),
  /** Fills the checklist from the default catalog on creation. */
  seedTimeline: z.boolean().default(true),
  /** Splits the total budget across the standard categories. */
  seedBudget: z.boolean().default(true),
});

export const updateWeddingSchema = z.object({
  title: trimmed(160).optional(),
  weddingDate: isoDate.optional(),
  venueName: optionalText(160),
  location: optionalText(160),
  timezone: z.string().trim().max(64).optional(),
  currency: z.string().trim().length(3).optional(),
  totalBudget: cents.optional(),
});

export const collaboratorRole = z.enum([
  "OWNER",
  "PARTNER",
  "PLANNER",
  "FAMILY",
]);
export const workspaceSection = z.enum([
  "TASKS",
  "BUDGET",
  "GUESTS",
  "VENDORS",
  "SEATING",
  "MOODBOARD",
  "WEBSITE",
]);
export const accessLevel = z.enum(["NONE", "VIEW", "EDIT"]);

export const inviteCollaboratorSchema = z.object({
  email: z.email().max(255).toLowerCase(),
  name: optionalText(120),
  // OWNER is assigned at creation only and cannot be handed out via invite.
  role: z.enum(["PARTNER", "PLANNER", "FAMILY"]),
  permissions: z
    .array(z.object({ section: workspaceSection, access: accessLevel }))
    .optional(),
});

export const updateCollaboratorSchema = z.object({
  role: z.enum(["PARTNER", "PLANNER", "FAMILY"]).optional(),
  permissions: z
    .array(z.object({ section: workspaceSection, access: accessLevel }))
    .optional(),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10).max(200),
});

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export const milestone = z.enum([
  "TWELVE_MONTHS",
  "NINE_MONTHS",
  "SIX_MONTHS",
  "THREE_MONTHS",
  "ONE_MONTH",
  "ONE_WEEK",
  "DAY_OF",
  "AFTER",
]);

export const createTaskSchema = z.object({
  title: trimmed(200),
  description: optionalText(2000),
  category: z.string().trim().max(60).default("General"),
  milestone,
  dueDate: nullableDate,
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  assignedToId: id.nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: trimmed(200).optional(),
  description: optionalText(2000),
  category: z.string().trim().max(60).optional(),
  milestone: milestone.optional(),
  dueDate: nullableDate,
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  assignedToId: id.nullable().optional(),
  completed: z.boolean().optional(),
});

export const generateTimelineSchema = z.object({
  /** Existing generated tasks are kept; only missing catalog entries are added. */
  replaceExisting: z.boolean().default(false),
});

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

export const createBudgetCategorySchema = z.object({
  name: trimmed(80),
  plannedAmount: cents.default(0),
  alertThresholdPct: z.number().int().min(1).max(100).default(90),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #B08968.")
    .default("#B08968"),
});

export const updateBudgetCategorySchema = partialForUpdate(createBudgetCategorySchema);

export const createBudgetItemSchema = z.object({
  categoryId: id,
  name: trimmed(160),
  vendorName: optionalText(160),
  plannedAmount: cents.default(0),
  actualAmount: cents.default(0),
  notes: optionalText(2000),
});

export const updateBudgetItemSchema = partialForUpdate(createBudgetItemSchema);

export const createPaymentSchema = z.object({
  label: z.string().trim().max(80).default("Payment"),
  amount: cents,
  dueDate: nullableDate,
  paidAt: nullableDate,
  method: optionalText(60),
  notes: optionalText(1000),
});

export const updatePaymentSchema = partialForUpdate(createPaymentSchema);

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

export const householdSchema = z.object({
  name: trimmed(160),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  postalCode: optionalText(20),
  country: optionalText(100),
  notes: optionalText(1000),
});

export const updateHouseholdSchema = partialForUpdate(householdSchema);

export const createGuestSchema = z.object({
  firstName: trimmed(80),
  lastName: z.string().trim().max(80).default(""),
  email: z.email().max(255).nullable().optional(),
  phone: optionalText(40),
  householdId: id.nullable().optional(),
  ageGroup: z.enum(["ADULT", "CHILD", "INFANT"]).default("ADULT"),
  dietaryRestrictions: optionalText(500),
  notes: optionalText(1000),
  plusOneAllowed: z.boolean().default(false),
  tagIds: z.array(id).default([]),
});

export const updateGuestSchema = partialForUpdate(createGuestSchema);

export const rsvpSchema = z.object({
  status: z.enum(["PENDING", "ATTENDING", "DECLINED", "MAYBE"]),
  mealOptionId: id.nullable().optional(),
  message: optionalText(1000),
});

export const guestTagSchema = z.object({
  name: trimmed(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#7D8471"),
});

export const mealOptionSchema = z.object({
  name: trimmed(80),
  description: optionalText(300),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

/** Bulk add, used by the paste/import box on the guest page. */
export const importGuestsSchema = z.object({
  guests: z
    .array(
      z.object({
        firstName: trimmed(80),
        lastName: z.string().trim().max(80).default(""),
        email: z.email().max(255).nullable().optional(),
        phone: optionalText(40),
        householdName: optionalText(160),
        ageGroup: z.enum(["ADULT", "CHILD", "INFANT"]).default("ADULT"),
        tags: z.array(z.string().trim().max(60)).default([]),
        dietaryRestrictions: optionalText(500),
        plusOneAllowed: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(1000),
});

/**
 * Parses the paste-a-list format used by the import box:
 * `First, Last, email, household, tag|tag`. Only the first name is required.
 */
export function parseGuestCsv(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => {
      const [firstName, lastName, email, householdName, tags] = line
        .split(",")
        .map((cell) => cell.trim());
      return {
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        email: email && email.includes("@") ? email : null,
        householdName: householdName || null,
        tags: tags ? tags.split("|").map((t) => t.trim()).filter(Boolean) : [],
        ageGroup: "ADULT" as const,
        plusOneAllowed: false,
      };
    })
    .filter((guest) => guest.firstName !== "");
}

// ---------------------------------------------------------------------------
// Seating chart (Phase 2)
// ---------------------------------------------------------------------------

/** Canvas coordinates are percentages, so a chart scales to any screen. */
const percent = z.number().min(0).max(100);

export const createSeatingTableSchema = z.object({
  name: trimmed(60),
  shape: z.enum(["ROUND", "RECTANGLE", "HEAD"]).default("ROUND"),
  capacity: z.number().int().min(1).max(60).default(8),
  x: percent.default(50),
  y: percent.default(50),
  rotation: z.number().int().min(0).max(359).default(0),
  notes: optionalText(500),
});

export const updateSeatingTableSchema = partialForUpdate(createSeatingTableSchema);

export const autoLayoutSchema = z.object({
  perTable: z.number().int().min(2).max(20).default(8),
});

/** `tableId: null` takes the guest out of the chart. */
export const assignSeatSchema = z.object({
  guestId: id,
  tableId: id.nullable(),
});

// ---------------------------------------------------------------------------
// Wedding website (Phase 2)
// ---------------------------------------------------------------------------

/**
 * Accepted loosely and normalised server-side by `siteSlugFrom`, so a couple
 * who types "Sam & Alex" gets `sam-and-alex` rather than a validation error.
 */
const siteSlug = z.string().trim().min(1).max(80);

export const updateSiteSchema = z.object({
  slug: siteSlug.optional(),
  template: z.enum(["CLASSIC", "GARDEN", "MODERN"]).optional(),
  headline: optionalText(160),
  intro: optionalText(600),
  storyTitle: trimmed(80).optional(),
  story: optionalText(5000),
  travelTitle: trimmed(80).optional(),
  travel: optionalText(5000),
  registryNote: optionalText(600),
  rsvpDeadline: nullableDate,
  rsvpNote: optionalText(600),
  coverUploadId: id.nullable().optional(),
  galleryEnabled: z.boolean().optional(),
  galleryNote: optionalText(600),
  guestBookEnabled: z.boolean().optional(),
  guestBookNote: optionalText(600),
  moderateGuestPosts: z.boolean().optional(),
});

export const publishSiteSchema = z.object({
  published: z.boolean(),
});

export const siteEventSchema = z.object({
  name: trimmed(80),
  startsAt: isoDate,
  endsAt: nullableDate,
  venueName: optionalText(160),
  address: optionalText(300),
  description: optionalText(1000),
  dressCode: optionalText(120),
  mapUrl: z.url().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

export const updateSiteEventSchema = partialForUpdate(siteEventSchema);

export const registryLinkSchema = z.object({
  label: trimmed(80),
  url: z.url().max(500),
  note: optionalText(300),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

export const updateRegistryLinkSchema = partialForUpdate(registryLinkSchema);

// ---------------------------------------------------------------------------
// Mood board (Phase 2)
// ---------------------------------------------------------------------------

export const moodCategory = z.enum([
  "ATTIRE",
  "FLORALS",
  "DECOR",
  "VENUE",
  "CAKE",
  "STATIONERY",
  "BEAUTY",
  "OTHER",
]);

export const createMoodItemSchema = z.object({
  uploadId: id.nullable().optional(),
  category: moodCategory.default("OTHER"),
  title: optionalText(120),
  note: optionalText(1000),
  sourceUrl: z.url().max(500).nullable().optional(),
});

export const updateMoodItemSchema = partialForUpdate(createMoodItemSchema);

export const updateMoodBoardSchema = z.object({
  title: trimmed(120).optional(),
});

export const shareMoodBoardSchema = z.object({
  shared: z.boolean(),
});

// ---------------------------------------------------------------------------
// Vendors & messaging (Phase 3)
// ---------------------------------------------------------------------------

export const vendorCategory = z.enum([
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
]);

export const vendorStatus = z.enum([
  "CONSIDERING",
  "CONTACTED",
  "QUOTED",
  "BOOKED",
  "DECLINED",
]);

/** A directory listing. Shared across weddings, so it carries nothing private. */
export const createVendorSchema = z.object({
  name: trimmed(160),
  category: vendorCategory.default("OTHER"),
  city: optionalText(100),
  region: optionalText(100),
  country: optionalText(100),
  website: z.url().max(300).nullable().optional(),
  email: z.email().max(255).nullable().optional(),
  phone: optionalText(40),
  /** 1-4, shown as $ to $$$$. */
  priceTier: z.number().int().min(1).max(4).nullable().optional(),
  description: optionalText(2000),
});

export const updateVendorSchema = partialForUpdate(createVendorSchema);

/**
 * Adds a vendor to this wedding's shortlist, either by picking an existing
 * directory entry (`vendorId`) or by describing a new one (`vendor`).
 */
export const addWeddingVendorSchema = z
  .object({
    vendorId: id.optional(),
    vendor: createVendorSchema.optional(),
    status: vendorStatus.default("CONSIDERING"),
    contactName: optionalText(120),
    contactEmail: z.email().max(255).nullable().optional(),
    notes: optionalText(2000),
    budgetItemId: id.nullable().optional(),
  })
  .refine((value) => Boolean(value.vendorId) !== Boolean(value.vendor), {
    message: "Pick a vendor from the directory or describe a new one.",
    path: ["vendorId"],
  });

export const updateWeddingVendorSchema = partialForUpdate(
  z.object({
    status: vendorStatus.default("CONSIDERING"),
    contactName: optionalText(120),
    contactEmail: z.email().max(255).nullable().optional(),
    notes: optionalText(2000),
    budgetItemId: id.nullable().optional(),
    subject: optionalText(160),
  }),
);

export const vendorReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: optionalText(120),
  body: optionalText(2000),
});

/** Query string for the directory. Numbers arrive as text, hence the coercion. */
export const directoryQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: vendorCategory.optional(),
  city: z.string().trim().max(100).optional(),
  minRating: z.coerce.number().min(0).max(5).default(0),
  sort: z.enum(["RATING", "NAME", "REVIEWS"]).default("RATING"),
});

/** Turns the vendor's link on or off. Enabling always mints a fresh token. */
export const threadAccessSchema = z.object({
  granted: z.boolean(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

/** The vendor's side of the conversation: no account, so they say who they are. */
export const vendorReplySchema = z.object({
  body: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  authorName: z.string().trim().max(120).optional(),
});

/**
 * Shares one thing into a thread. Exactly one of the two, matching the schema's
 * one-of-two foreign keys.
 */
export const shareIntoThreadSchema = z
  .object({
    moodBoard: z.boolean().optional(),
    budgetItemId: id.optional(),
  })
  .refine(
    (value) => Boolean(value.moodBoard) !== Boolean(value.budgetItemId),
    {
      message: "Share either the mood board or one budget line.",
      path: ["budgetItemId"],
    },
  );

export const revokeShareSchema = z.object({
  shareId: id,
});

// ---------------------------------------------------------------------------
// Guest contributions, itineraries, AI and tours (Phase 4)
// ---------------------------------------------------------------------------

/** A guest posting a photo. Their name is whatever they type — unverified. */
export const galleryUploadSchema = z.object({
  uploaderName: z.string().trim().max(MAX_GUEST_NAME).optional(),
  caption: z.string().trim().max(MAX_CAPTION).optional(),
});

/** A guest replying from their own itinerary link. */
export const publicRsvpSchema = z.object({
  status: z.enum(["ATTENDING", "DECLINED", "MAYBE"]),
  mealOptionId: id.nullable().optional(),
  dietaryRestrictions: optionalText(500),
  message: optionalText(1000),
  /** Only honoured when this guest is actually hosting a plus-one. */
  plusOneStatus: z.enum(["ATTENDING", "DECLINED", "MAYBE"]).optional(),
  plusOneMealOptionId: id.nullable().optional(),
});

export const rsvpLookupSchema = z.object({
  firstName: trimmed(80),
  lastName: trimmed(80),
});

export const guestBookKind = z.enum(["TEXT", "VOICE", "VIDEO"]);

export const guestBookEntrySchema = z
  .object({
    kind: guestBookKind.default("TEXT"),
    guestName: trimmed(MAX_GUEST_NAME),
    message: z.string().trim().max(MAX_GUEST_MESSAGE).optional(),
  })
  .refine((value) => value.kind !== "TEXT" || Boolean(value.message), {
    message: "Write a message, or record one instead.",
    path: ["message"],
  });

/**
 * Approving and hiding are independent: a photo can be approved and later pulled,
 * and un-hiding should not silently un-approve it.
 */
export const moderateSubmissionSchema = z
  .object({
    approved: z.boolean().optional(),
    hidden: z.boolean().optional(),
  })
  .refine(
    (value) => value.approved !== undefined || value.hidden !== undefined,
    { message: "Nothing to change." },
  );

export const issueItinerariesSchema = z.object({
  /** Replaces every existing link, invalidating any already sent. */
  regenerate: z.boolean().default(false),
});

export const aiDraftKind = z.enum(["VOWS", "SPEECH", "THANK_YOU", "INVITATION"]);

export const generateDraftSchema = z.object({
  kind: aiDraftKind,
  brief: trimmed(2000),
  tone: z.enum(["WARM", "FUNNY", "FORMAL", "PLAIN"]).default("WARM"),
  length: z.enum(["SHORT", "MEDIUM", "LONG"]).default("MEDIUM"),
  title: optionalText(120),
});

export const styleQuizSchema = z.object({
  /** Question id to chosen option id. Unknown keys are ignored when scoring. */
  answers: z.record(z.string().max(40), z.string().max(40)),
});

export const vendorMediaKind = z.enum([
  "PHOTO",
  "PANORAMA",
  "TOUR_URL",
  "VIDEO_URL",
]);

/**
 * A media item is either hosted by us (`uploadId`) or a link to someone else's
 * viewer (`url`) — never both, and never neither.
 */
export const vendorMediaSchema = z
  .object({
    kind: vendorMediaKind,
    /**
     * Which workspace the caller is acting for. The vendor listing is shared, so
     * it has no plan of its own — entitlement comes from the wedding adding the
     * media, and naming it explicitly beats guessing.
     */
    weddingId: id,
    uploadId: id.optional(),
    url: z.url().max(500).optional(),
    caption: optionalText(200),
    sortOrder: z.number().int().min(0).max(100).default(0),
  })
  .refine((value) => Boolean(value.uploadId) !== Boolean(value.url), {
    message: "Upload a file or give a link, not both.",
    path: ["url"],
  })
  .refine(
    (value) =>
      (value.kind === "TOUR_URL" || value.kind === "VIDEO_URL") ===
      Boolean(value.url),
    {
      message: "Tours and videos are links; photos and panoramas are uploads.",
      path: ["kind"],
    },
  );

/**
 * A Pro unlock code as typed. Deliberately loose on shape — spacing, dashes and
 * the prefix are all normalised later, and a length ceiling is enough here to
 * keep an essay out of the hashing function.
 */
export const unlockCodeSchema = z.object({
  code: trimmed(64),
});
