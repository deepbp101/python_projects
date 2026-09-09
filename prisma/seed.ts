/**
 * Development seed: one realistic wedding, eight months out, mid-planning.
 *
 * Deliberately messy in the ways real data is — some RSVPs outstanding, a
 * category slightly over budget, an overdue deposit — so the dashboard states
 * are all reachable without hand-editing rows.
 *
 * Run with `npm run db:seed`.
 */
import { rm } from "node:fs/promises";
import "dotenv/config";
import { makePdf, makePng, makeWav } from "./seed-images";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { addDays, startOfUtcDay, subDays } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { siteSlugFrom } from "@/lib/domain/site";
import { generateTimeline } from "@/lib/domain/timeline";
import { scoreStyle } from "@/lib/domain/style";
import { vendorSlugFrom } from "@/lib/domain/vendors";
import { defaultPermissionsForRole } from "@/lib/permissions";
import { mintUnlockCode } from "@/lib/services/plan";
import { slugify } from "@/lib/services/wedding";
import { buildStorageKey, getStorage } from "@/lib/storage";

const DEMO_PASSWORD = "wedding-demo-2026";

/**
 * Fixed share token for the demo florist, so the seed can print a working
 * `/vendor/...` link. Real tokens are random and only their hash is stored, which
 * means a generated one could never be printed after the fact.
 */
const FERN_TOKEN = "demo-florist-thread-token";

const WEDDING_TIMEZONE = "America/New_York";

const today = startOfUtcDay(new Date());
const weddingDate = addDays(today, 243); // roughly eight months out

const money = (dollars: number) => Math.round(dollars * 100);

/**
 * An instant for a wall-clock time in the wedding's timezone.
 *
 * Event times are instants, and the site renders them in the wedding's zone — so
 * "3pm ceremony" has to be stored as the UTC moment that is 3pm in New York, not
 * as 15:00 UTC. Derived from the zone rather than a hard-coded offset so it stays
 * right across the daylight-saving boundary.
 */
function localTime(day: Date, hour: number, minute = 0): Date {
  const guess = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute),
  );
  // What that guess reads as in the target zone, to measure the offset.
  const asZoned = new Date(
    guess.toLocaleString("en-US", { timeZone: WEDDING_TIMEZONE }),
  );
  const asUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() + (asUtc.getTime() - asZoned.getTime()));
}

async function main() {
  console.log("Clearing existing data…");
  // Most rows cascade from Wedding. Vendor does not — a directory listing is
  // shared across weddings and outlives any one of them — so it needs clearing
  // explicitly or a reseed collides on the slug.
  await prisma.wedding.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.user.deleteMany({});
  // Rate limit windows are keyed by string, not by foreign key, so they survive
  // everything above. Cleared too: reseeding to try the guest pages and finding
  // yourself still throttled from the last run is nobody's idea of a fresh start.
  await prisma.rateLimit.deleteMany({});
  // Unlock codes survive their wedding by design (the FK nulls rather than
  // cascades, so a deleted workspace does not destroy the record that a code was
  // spent). That is right in production and wrong for a reseed, which wants a
  // clean slate.
  await prisma.unlockCode.deleteMany({});
  // Stored files are outside the database, so they need clearing separately.
  await rm(process.env.UPLOAD_DIR ?? ".uploads", { recursive: true, force: true });

  console.log("Creating accounts…");
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const [sam, alex, jamie, robin] = await Promise.all([
    prisma.user.create({
      data: { email: "sam@example.com", name: "Sam Okafor", passwordHash },
    }),
    prisma.user.create({
      data: { email: "alex@example.com", name: "Alex Moreau", passwordHash },
    }),
    prisma.user.create({
      data: { email: "jamie@example.com", name: "Jamie Reyes", passwordHash },
    }),
    prisma.user.create({
      data: { email: "robin@example.com", name: "Robin Okafor", passwordHash },
    }),
  ]);

  console.log("Creating the wedding…");
  const wedding = await prisma.wedding.create({
    data: {
      slug: slugify("Sam and Alex"),
      title: "Sam & Alex",
      weddingDate,
      venueName: "The Old Mill",
      location: "Hudson Valley, NY",
      // A real zone, not UTC: event times are instants, and the public site and
      // itineraries render them where the wedding is.
      timezone: WEDDING_TIMEZONE,
      currency: "USD",
      totalBudget: money(42_000),
      // Pro, because the demo is meant to show the whole product — vendor
      // messaging, venue tours and recorded guest book entries are all Pro, and
      // on Free the seeded florist thread would answer 402 instead of opening.
      // Unlocked a while back, so the settings panel shows a real date rather
      // than a suspiciously fresh one.
      plan: "PRO",
      planUnlockedAt: subDays(today, 210),
    },
  });

  // --- collaborators -------------------------------------------------------
  await prisma.collaborator.create({
    data: {
      weddingId: wedding.id,
      userId: sam.id,
      email: sam.email,
      name: sam.name,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: new Date(),
    },
  });

  for (const [user, role] of [
    [alex, "PARTNER"],
    [jamie, "PLANNER"],
    [robin, "FAMILY"],
  ] as const) {
    await prisma.collaborator.create({
      data: {
        weddingId: wedding.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        role,
        status: "ACTIVE",
        joinedAt: new Date(),
        invitedById: sam.id,
        permissions: {
          create: Object.entries(defaultPermissionsForRole(role)).map(
            ([section, access]) => ({
              section: section as never,
              access: access as never,
            }),
          ),
        },
      },
    });
  }

  // --- checklist -----------------------------------------------------------
  console.log("Generating the checklist…");
  const timeline = generateTimeline(weddingDate);
  await prisma.task.createMany({
    data: timeline.map((task) => ({
      weddingId: wedding.id,
      templateKey: task.templateKey,
      title: task.title,
      description: task.description,
      category: task.category,
      milestone: task.milestone,
      priority: task.priority,
      dueDate: task.dueDate,
      sortOrder: task.sortOrder,
      isCustom: false,
    })),
  });

  // Everything from the early phases is already done, plus one overdue task
  // left open so the dashboard has something to flag.
  const doneKeys = [
    "set-budget",
    "draft-guest-list",
    "choose-wedding-party",
    "hire-planner",
    "book-venue",
    "research-vendors",
    "book-photographer",
    "book-caterer",
    "book-music",
    "shop-wedding-dress",
    "book-florist",
    "book-officiant",
  ];
  await prisma.task.updateMany({
    where: { weddingId: wedding.id, templateKey: { in: doneKeys } },
    data: { completedAt: subDays(today, 20), completedById: sam.id },
  });

  await prisma.task.create({
    data: {
      weddingId: wedding.id,
      title: "Chase the calligrapher for a quote",
      description: "Third follow-up. Try calling rather than emailing.",
      category: "Guests",
      milestone: "SIX_MONTHS",
      priority: "HIGH",
      dueDate: subDays(today, 6),
      isCustom: true,
    },
  });

  // --- budget --------------------------------------------------------------
  console.log("Building the budget…");
  const categorySpec = [
    { name: "Venue & Rentals", planned: 13_000, color: "#8C6E63" },
    { name: "Catering & Bar", planned: 9_500, color: "#A98467" },
    { name: "Photography & Video", planned: 5_200, color: "#6B7F6E" },
    { name: "Attire & Beauty", planned: 3_400, color: "#B9868B" },
    { name: "Flowers & Decor", planned: 3_200, color: "#7D8471" },
    { name: "Music & Entertainment", planned: 2_800, color: "#7A7089" },
    { name: "Stationery & Website", planned: 1_100, color: "#9A8C98" },
    { name: "Cake & Desserts", planned: 900, color: "#C2A083" },
    { name: "Transportation", planned: 1_200, color: "#6E7B8B" },
    { name: "Rings & Gifts", planned: 1_700, color: "#B08968" },
  ];

  const categories = new Map<string, string>();
  for (const [index, spec] of categorySpec.entries()) {
    const category = await prisma.budgetCategory.create({
      data: {
        weddingId: wedding.id,
        name: spec.name,
        plannedAmount: money(spec.planned),
        color: spec.color,
        sortOrder: index,
      },
    });
    categories.set(spec.name, category.id);
  }

  type SeedPayment = {
    label: string;
    amount: number;
    dueInDays: number;
    paid: boolean;
  };

  const itemSpec: {
    category: string;
    name: string;
    vendor?: string;
    planned: number;
    payments: SeedPayment[];
  }[] = [
    {
      category: "Venue & Rentals",
      name: "Venue hire",
      vendor: "The Old Mill",
      planned: 11_000,
      payments: [
        { label: "Deposit", amount: 3_500, dueInDays: -120, paid: true },
        { label: "Instalment", amount: 3_500, dueInDays: -10, paid: true },
        { label: "Final payment", amount: 4_000, dueInDays: 210, paid: false },
      ],
    },
    {
      category: "Venue & Rentals",
      name: "Tables, chairs & linens",
      vendor: "Hudson Event Rentals",
      planned: 2_100,
      payments: [
        { label: "Deposit", amount: 600, dueInDays: -3, paid: false },
      ],
    },
    {
      category: "Catering & Bar",
      name: "Dinner service",
      vendor: "Sage & Salt Catering",
      planned: 7_800,
      payments: [
        { label: "Deposit", amount: 2_000, dueInDays: -60, paid: true },
        { label: "Final payment", amount: 5_800, dueInDays: 228, paid: false },
      ],
    },
    {
      category: "Catering & Bar",
      name: "Bar & bartenders",
      planned: 1_900,
      payments: [{ label: "Deposit", amount: 500, dueInDays: 21, paid: false }],
    },
    {
      category: "Photography & Video",
      name: "Photography package",
      vendor: "Lena Prescott Photo",
      planned: 4_200,
      payments: [
        { label: "Deposit", amount: 1_400, dueInDays: -90, paid: true },
        { label: "Final payment", amount: 2_800, dueInDays: 236, paid: false },
      ],
    },
    {
      category: "Attire & Beauty",
      name: "Wedding dress & alterations",
      planned: 2_400,
      payments: [
        { label: "Deposit", amount: 1_200, dueInDays: -45, paid: true },
      ],
    },
    {
      category: "Attire & Beauty",
      name: "Suit & shoes",
      planned: 1_300,
      payments: [{ label: "Payment", amount: 1_300, dueInDays: -5, paid: true }],
    },
    {
      // Deliberately over its category budget, to exercise the alert path.
      category: "Flowers & Decor",
      name: "Ceremony & reception florals",
      vendor: "Fern & Thistle",
      planned: 3_400,
      payments: [
        { label: "Deposit", amount: 1_700, dueInDays: -30, paid: true },
        { label: "Instalment", amount: 1_600, dueInDays: -2, paid: true },
      ],
    },
    {
      category: "Music & Entertainment",
      name: "Band (4 hours)",
      vendor: "The Rivertones",
      planned: 2_600,
      payments: [
        { label: "Deposit", amount: 800, dueInDays: -70, paid: true },
        { label: "Final payment", amount: 1_800, dueInDays: 240, paid: false },
      ],
    },
    {
      category: "Stationery & Website",
      name: "Invitations & save-the-dates",
      planned: 950,
      payments: [{ label: "Payment", amount: 420, dueInDays: -14, paid: true }],
    },
    {
      category: "Cake & Desserts",
      name: "Wedding cake",
      vendor: "Bloom Bakery",
      planned: 850,
      payments: [{ label: "Deposit", amount: 250, dueInDays: 9, paid: false }],
    },
    {
      category: "Transportation",
      name: "Guest shuttle",
      planned: 1_150,
      payments: [],
    },
    {
      category: "Rings & Gifts",
      name: "Wedding bands",
      planned: 1_600,
      payments: [{ label: "Deposit", amount: 800, dueInDays: 30, paid: false }],
    },
  ];

  /** Line items by name, so vendors can be linked to what pays for them. */
  const budgetItems = new Map<string, string>();

  for (const spec of itemSpec) {
    const categoryId = categories.get(spec.category);
    if (!categoryId) throw new Error(`Unknown category: ${spec.category}`);

    const item = await prisma.budgetItem.create({
      data: {
        weddingId: wedding.id,
        categoryId,
        name: spec.name,
        vendorName: spec.vendor ?? null,
        plannedAmount: money(spec.planned),
        payments: {
          create: spec.payments.map((payment) => ({
            label: payment.label,
            amount: money(payment.amount),
            dueDate: addDays(today, payment.dueInDays),
            paidAt: payment.paid ? addDays(today, payment.dueInDays) : null,
          })),
        },
      },
    });

    budgetItems.set(spec.name, item.id);
  }

  // --- guests --------------------------------------------------------------
  console.log("Adding guests…");
  const tagSpec = [
    { name: "Family", color: "#8C6E63" },
    { name: "Friends", color: "#6B7F6E" },
    { name: "Work", color: "#6E7B8B" },
    { name: "Wedding party", color: "#B9868B" },
  ];
  const tags = new Map<string, string>();
  for (const spec of tagSpec) {
    const tag = await prisma.guestTag.create({
      data: { weddingId: wedding.id, ...spec },
    });
    tags.set(spec.name, tag.id);
  }

  const mealSpec = [
    { name: "Chicken", description: "Herb-roasted chicken", sortOrder: 0 },
    { name: "Beef", description: "Braised short rib", sortOrder: 1 },
    { name: "Fish", description: "Pan-seared sea bass", sortOrder: 2 },
    { name: "Vegetarian", description: "Wild mushroom risotto", sortOrder: 3 },
  ];
  const meals = new Map<string, string>();
  for (const spec of mealSpec) {
    const meal = await prisma.mealOption.create({
      data: { weddingId: wedding.id, ...spec },
    });
    meals.set(spec.name, meal.id);
  }

  const householdSpec = [
    { name: "The Okafor Family", city: "Brooklyn", state: "NY", postalCode: "11201", line1: "44 Bergen Street" },
    { name: "The Moreau Family", city: "Montreal", state: "QC", postalCode: "H2T 1S5", line1: "1290 Rue Saint-Denis" },
    { name: "The Whitfields", city: "Beacon", state: "NY", postalCode: "12508", line1: "8 Fishkill Avenue" },
    { name: "The Nakamuras", city: "Jersey City", state: "NJ", postalCode: "07302", line1: "212 Grove Street" },
    { name: "The Delgados", city: "Philadelphia", state: "PA", postalCode: "19146", line1: "1533 South Street" },
  ];
  const households = new Map<string, string>();
  for (const spec of householdSpec) {
    const household = await prisma.household.create({
      data: {
        weddingId: wedding.id,
        name: spec.name,
        addressLine1: spec.line1,
        city: spec.city,
        state: spec.state,
        postalCode: spec.postalCode,
        country: "USA",
      },
    });
    households.set(spec.name, household.id);
  }

  type SeedGuest = {
    first: string;
    last: string;
    email?: string;
    household?: string;
    tags: string[];
    status: "PENDING" | "ATTENDING" | "DECLINED" | "MAYBE";
    meal?: string;
    age?: "ADULT" | "CHILD" | "INFANT";
    dietary?: string;
    plusOne?: boolean;
  };

  const guestSpec: SeedGuest[] = [
    { first: "Ada", last: "Okafor", household: "The Okafor Family", tags: ["Family"], status: "ATTENDING", meal: "Beef" },
    { first: "Chidi", last: "Okafor", household: "The Okafor Family", tags: ["Family"], status: "ATTENDING", meal: "Chicken" },
    { first: "Nkem", last: "Okafor", household: "The Okafor Family", tags: ["Family"], status: "ATTENDING", meal: "Vegetarian", age: "CHILD" },
    { first: "Céline", last: "Moreau", household: "The Moreau Family", tags: ["Family"], status: "ATTENDING", meal: "Fish", dietary: "No shellfish" },
    { first: "Henri", last: "Moreau", household: "The Moreau Family", tags: ["Family"], status: "ATTENDING", meal: "Beef" },
    { first: "Margot", last: "Moreau", household: "The Moreau Family", tags: ["Family"], status: "MAYBE" },
    { first: "Priya", last: "Whitfield", email: "priya@example.com", household: "The Whitfields", tags: ["Friends", "Wedding party"], status: "ATTENDING", meal: "Vegetarian", dietary: "Vegetarian, no dairy", plusOne: true },
    { first: "Tom", last: "Whitfield", household: "The Whitfields", tags: ["Friends"], status: "ATTENDING", meal: "Chicken" },
    { first: "Yuki", last: "Nakamura", email: "yuki@example.com", household: "The Nakamuras", tags: ["Friends", "Wedding party"], status: "ATTENDING", meal: "Fish" },
    { first: "Ren", last: "Nakamura", household: "The Nakamuras", tags: ["Friends"], status: "ATTENDING", meal: "Beef" },
    { first: "Sofia", last: "Nakamura", household: "The Nakamuras", tags: ["Friends"], status: "ATTENDING", age: "INFANT" },
    { first: "Marisol", last: "Delgado", email: "marisol@example.com", household: "The Delgados", tags: ["Friends"], status: "DECLINED" },
    { first: "Rafael", last: "Delgado", household: "The Delgados", tags: ["Friends"], status: "DECLINED" },
    { first: "Nadia", last: "Farouk", email: "nadia@example.com", tags: ["Work"], status: "ATTENDING", meal: "Chicken", dietary: "Halal" },
    { first: "Ben", last: "Sørensen", email: "ben@example.com", tags: ["Work"], status: "PENDING", plusOne: true },
    { first: "Grace", last: "Adeyemi", email: "grace@example.com", tags: ["Work"], status: "PENDING" },
    { first: "Owen", last: "Fitzgerald", email: "owen@example.com", tags: ["Friends", "Wedding party"], status: "ATTENDING", meal: "Beef" },
    { first: "Ines", last: "Cardoso", email: "ines@example.com", tags: ["Friends"], status: "MAYBE" },
    { first: "Dev", last: "Ramachandran", email: "dev@example.com", tags: ["Work"], status: "PENDING" },
    { first: "Harriet", last: "Boyle", email: "harriet@example.com", tags: ["Family"], status: "ATTENDING", meal: "Fish", dietary: "Gluten free" },
    { first: "Leo", last: "Boyle", tags: ["Family"], status: "ATTENDING", meal: "Chicken" },
    { first: "Anaya", last: "Kapoor", email: "anaya@example.com", tags: ["Friends"], status: "PENDING" },
    { first: "Marcus", last: "Bell", email: "marcus@example.com", tags: ["Work"], status: "DECLINED" },
    { first: "Fiona", last: "Sullivan", email: "fiona@example.com", tags: ["Friends"], status: "ATTENDING", meal: "Vegetarian", dietary: "Vegan" },
  ];

  const createdGuests = new Map<string, string>();
  for (const spec of guestSpec) {
    const guest = await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        firstName: spec.first,
        lastName: spec.last,
        email: spec.email ?? null,
        householdId: spec.household
          ? (households.get(spec.household) ?? null)
          : null,
        ageGroup: spec.age ?? "ADULT",
        dietaryRestrictions: spec.dietary ?? null,
        plusOneAllowed: spec.plusOne ?? false,
        tags: {
          create: spec.tags
            .map((name) => tags.get(name))
            .filter((id): id is string => Boolean(id))
            .map((tagId) => ({ tagId })),
        },
        rsvp: {
          create: {
            status: spec.status,
            mealOptionId: spec.meal ? (meals.get(spec.meal) ?? null) : null,
            respondedAt: spec.status === "PENDING" ? null : subDays(today, 12),
          },
        },
      },
    });
    createdGuests.set(`${spec.first} ${spec.last}`, guest.id);
  }

  // One plus-one has been claimed, so the plus-one path has real data.
  const priyaId = createdGuests.get("Priya Whitfield");
  if (priyaId) {
    await prisma.guest.create({
      data: {
        weddingId: wedding.id,
        firstName: "Sam",
        lastName: "Ortiz",
        plusOneOfGuestId: priyaId,
        householdId: households.get("The Whitfields") ?? null,
        rsvp: {
          create: {
            status: "ATTENDING",
            mealOptionId: meals.get("Chicken") ?? null,
            respondedAt: subDays(today, 12),
          },
        },
      },
    });
  }

  // --- seating chart -------------------------------------------------------
  console.log("Arranging the seating chart…");
  const tableSpec = [
    { name: "Head table", shape: "HEAD" as const, capacity: 8, x: 50, y: 12 },
    { name: "Table 1", shape: "ROUND" as const, capacity: 8, x: 20, y: 40 },
    { name: "Table 2", shape: "ROUND" as const, capacity: 8, x: 50, y: 40 },
    { name: "Table 3", shape: "ROUND" as const, capacity: 8, x: 80, y: 40 },
    { name: "Table 4", shape: "ROUND" as const, capacity: 6, x: 35, y: 70 },
    { name: "Table 5", shape: "RECTANGLE" as const, capacity: 6, x: 68, y: 70 },
  ];

  const tableIds = new Map<string, string>();
  for (const spec of tableSpec) {
    const table = await prisma.seatingTable.create({
      data: { weddingId: wedding.id, ...spec },
    });
    tableIds.set(spec.name, table.id);
  }

  // Seat most of the confirmed guests, leaving a few to place by hand so the
  // "still to seat" list is not empty on first look.
  const seatingPlan: Record<string, string[]> = {
    "Head table": [
      "Priya Whitfield",
      "Yuki Nakamura",
      "Owen Fitzgerald",
      "Tom Whitfield",
    ],
    "Table 1": ["Ada Okafor", "Chidi Okafor", "Nkem Okafor"],
    "Table 2": ["Céline Moreau", "Henri Moreau", "Margot Moreau"],
    "Table 3": ["Ren Nakamura", "Sofia Nakamura", "Nadia Farouk"],
  };

  for (const [tableName, guestNames] of Object.entries(seatingPlan)) {
    const tableId = tableIds.get(tableName);
    if (!tableId) continue;
    for (const guestName of guestNames) {
      const guestId = createdGuests.get(guestName);
      if (guestId) {
        await prisma.seatAssignment.create({ data: { guestId, tableId } });
      }
    }
  }

  // --- wedding website -----------------------------------------------------
  console.log("Publishing the wedding website…");
  const site = await prisma.weddingSite.create({
    data: {
      weddingId: wedding.id,
      slug: siteSlugFrom("Sam and Alex"),
      template: "GARDEN",
      headline: "Sam & Alex",
      intro:
        "We're getting married at The Old Mill, and we would love you there.",
      storyTitle: "How we got here",
      story: [
        "We met in the queue for a coffee cart that had run out of coffee. Alex stayed to complain; Sam stayed because Alex was funny about it.",
        "Seven years, two cities and one very opinionated cat later, we're doing this properly — in a barn, by a river, with everyone we love.",
      ].join("\n\n"),
      travelTitle: "Getting there & staying over",
      travel: [
        "The Old Mill is about ninety minutes north of New York City. Metro-North runs to Beacon, and we'll have a shuttle meeting the 2:14pm train.",
        "We've held rooms at The Roundhouse and the Beacon Hotel under \"Okafor–Moreau\" until three weeks before the wedding.",
      ].join("\n\n"),
      registryNote:
        "Your being there is genuinely the gift. If you'd like to mark the day with something, here's where we're registered.",
      rsvpDeadline: subDays(weddingDate, 30),
      rsvpNote:
        "Please reply using the card in your invitation, or email us — whichever is easier.",
      publishedAt: subDays(today, 30),
      events: {
        create: [
          {
            name: "Ceremony",
            startsAt: localTime(weddingDate, 15, 0),
            venueName: "The Old Mill, riverside lawn",
            address: "112 Mill Road, Beacon, NY 12508",
            description: "Seats from 2:30pm. It's grass — bring sensible shoes.",
            dressCode: "Garden formal",
            sortOrder: 0,
          },
          {
            name: "Drinks & dinner",
            startsAt: localTime(weddingDate, 17, 30),
            venueName: "The Old Mill, barn",
            address: "112 Mill Road, Beacon, NY 12508",
            description: "Dinner at 6:30pm, dancing until late.",
            sortOrder: 1,
          },
          {
            name: "Farewell brunch",
            startsAt: localTime(addDays(weddingDate, 1), 10, 30),
            venueName: "The Roundhouse",
            address: "2 East Main Street, Beacon, NY 12508",
            description: "Drop in any time before noon on your way home.",
            sortOrder: 2,
          },
        ],
      },
      registry: {
        create: [
          {
            label: "Crate & Barrel",
            url: "https://www.crateandbarrel.com/gift-registry",
            note: "Kitchen things, mostly.",
            sortOrder: 0,
          },
          {
            label: "Honeymoon fund",
            url: "https://example.com/sam-and-alex-honeymoon",
            note: "Towards two weeks in Portugal.",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  // --- mood board ----------------------------------------------------------
  console.log("Filling the mood board…");
  const board = await prisma.moodBoard.create({
    data: { weddingId: wedding.id, title: "Our vision" },
  });

  const moodSpec = [
    { category: "FLORALS" as const, title: "Loose garden roses", note: "Blush and cream, nothing too structured.", colour: [201, 160, 160] as [number, number, number], w: 600, h: 800 },
    { category: "ATTIRE" as const, title: "Silk slip dress", note: "Bias cut, low back.", colour: [231, 222, 209] as [number, number, number], w: 600, h: 900 },
    { category: "DECOR" as const, title: "Long tables, low candles", note: "Taper candles at different heights.", colour: [176, 137, 104] as [number, number, number], w: 900, h: 600 },
    { category: "VENUE" as const, title: "Barn with the doors open", note: "Exactly the light we want at 6pm.", colour: [125, 132, 113] as [number, number, number], w: 900, h: 600 },
    { category: "CAKE" as const, title: "Naked cake, seasonal fruit", note: "Not too sweet — ask about the lemon one.", colour: [222, 205, 180] as [number, number, number], w: 600, h: 700 },
    { category: "STATIONERY" as const, title: "Letterpress, deckled edge", note: "Warm white stock, brown ink.", colour: [196, 178, 155] as [number, number, number], w: 800, h: 600 },
  ];

  const storage = getStorage();
  for (const [index, spec] of moodSpec.entries()) {
    const bytes = makePng(spec.w, spec.h, spec.colour);
    const storageKey = buildStorageKey(wedding.id, "image/png");
    await storage.put(storageKey, bytes, "image/png");

    const upload = await prisma.upload.create({
      data: {
        weddingId: wedding.id,
        storageKey,
        originalName: `${spec.title.toLowerCase().replace(/\s+/g, "-")}.png`,
        mimeType: "image/png",
        sizeBytes: bytes.byteLength,
        width: spec.w,
        height: spec.h,
        createdById: sam.id,
      },
    });

    await prisma.moodBoardItem.create({
      data: {
        boardId: board.id,
        uploadId: upload.id,
        category: spec.category,
        title: spec.title,
        note: spec.note,
        sortOrder: index,
        createdById: sam.id,
      },
    });
  }

  // --- vendors, reviews & threads -------------------------------------------
  console.log("Adding vendors…");

  /**
   * A few other couples exist only to own reviews. A directory rating that
   * aggregates one wedding is not a rating, so the demo needs strangers in it.
   */
  const neighbours = await Promise.all(
    [
      { email: "priya@example.com", name: "Priya Raman", title: "Priya & Tom" },
      { email: "devon@example.com", name: "Devon Clarke", title: "Devon & Wes" },
      { email: "mira@example.com", name: "Mira Halvorsen", title: "Mira & Jo" },
    ].map(async (spec, index) => {
      const user = await prisma.user.create({
        data: { email: spec.email, name: spec.name, passwordHash },
      });
      const theirWedding = await prisma.wedding.create({
        data: {
          slug: slugify(spec.title),
          title: spec.title,
          weddingDate: subDays(today, 120 + index * 90),
          collaborators: {
            create: {
              userId: user.id,
              email: user.email,
              name: user.name,
              role: "OWNER",
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          },
        },
      });
      return { user, wedding: theirWedding };
    }),
  );

  const vendorSpec = [
    {
      key: "mill",
      name: "The Old Mill",
      category: "VENUE" as const,
      city: "Hudson Valley",
      region: "NY",
      priceTier: 3,
      website: "https://example.com/the-old-mill",
      description:
        "Restored 1860s mill on the river. Ceremony lawn, barn reception for up to 160.",
    },
    {
      key: "sage",
      name: "Sage & Salt Catering",
      category: "CATERING" as const,
      city: "Beacon",
      region: "NY",
      priceTier: 3,
      description: "Seasonal menus, family style. Runs its own bar service.",
    },
    {
      key: "lena",
      name: "Lena Prescott Photo",
      category: "PHOTOGRAPHY" as const,
      city: "Brooklyn",
      region: "NY",
      priceTier: 3,
      description: "Documentary coverage, mostly natural light. Two shooters.",
    },
    {
      key: "fern",
      name: "Fern & Thistle",
      category: "FLORIST" as const,
      city: "Kingston",
      region: "NY",
      priceTier: 2,
      description: "Loose, garden-style arrangements grown locally where possible.",
    },
    {
      key: "rivertones",
      name: "The Rivertones",
      category: "MUSIC" as const,
      city: "Poughkeepsie",
      region: "NY",
      priceTier: 2,
      description: "Six-piece soul and Motown covers band. Four-hour sets.",
    },
    {
      key: "hudson",
      name: "Hudson Event Rentals",
      category: "RENTALS" as const,
      city: "Hudson Valley",
      region: "NY",
      priceTier: 2,
      description: "Tables, chairs, linens and glassware. Delivery and collection.",
    },
    // Not on our shortlist — the directory has to have something left to find.
    {
      key: "bloom",
      name: "Bloom Bakery",
      category: "CAKE" as const,
      city: "Beacon",
      region: "NY",
      priceTier: 1,
      description: "Naked cakes and seasonal fruit. Tastings on Saturdays.",
    },
    {
      key: "wildflower",
      name: "Wildflower Studio",
      category: "FLORIST" as const,
      city: "Brooklyn",
      region: "NY",
      priceTier: 3,
      description: "Sculptural, architectural installations. Books a year out.",
    },
    {
      key: "quarry",
      name: "The Quarry House",
      category: "VENUE" as const,
      city: "New Paltz",
      region: "NY",
      priceTier: 4,
      description: "Glass pavilion above a flooded quarry. 90 seated.",
    },
  ];

  const vendorIds = new Map<string, string>();
  for (const spec of vendorSpec) {
    const { key, ...fields } = spec;
    const created = await prisma.vendor.create({
      data: {
        ...fields,
        slug: vendorSlugFrom(fields.name, fields.city),
        country: "US",
        createdById: sam.id,
      },
    });
    vendorIds.set(key, created.id);
  }

  const reviewSpec = [
    { vendor: "mill", by: 0, rating: 5, title: "Worth the drive", body: "The barn at golden hour did most of the work for us." },
    { vendor: "mill", by: 1, rating: 4, title: "Beautiful, tight on parking", body: "Plan the shuttle early. Everything else was faultless." },
    { vendor: "sage", by: 0, rating: 5, title: "Guests still talk about it", body: "Family style was the right call. Handled two allergies without fuss." },
    { vendor: "sage", by: 2, rating: 4, title: "Lovely food, slow to reply", body: "Worth the chasing, but expect to chase." },
    { vendor: "lena", by: 1, rating: 5, title: "Barely noticed her there", body: "Which is exactly what we wanted. Gallery back in three weeks." },
    { vendor: "fern", by: 2, rating: 4, title: "Gorgeous, went slightly over", body: "Ask for the itemised quote up front." },
    { vendor: "wildflower", by: 0, rating: 5, title: "Extraordinary installation", body: "Expensive and worth it. Book early." },
    { vendor: "quarry", by: 1, rating: 3, title: "Stunning but inflexible", body: "Hard stop at 10pm, no exceptions, and the bar list is fixed." },
    { vendor: "bloom", by: 2, rating: 5, title: "The lemon one", body: "Order the lemon one." },
    { vendor: "rivertones", by: 0, rating: 4, title: "Filled the floor", body: "Ignore the setlist they send and just tell them what you like." },
  ];

  for (const spec of reviewSpec) {
    const neighbour = neighbours[spec.by];
    await prisma.vendorReview.create({
      data: {
        vendorId: vendorIds.get(spec.vendor)!,
        weddingId: neighbour.wedding.id,
        authorId: neighbour.user.id,
        rating: spec.rating,
        title: spec.title,
        body: spec.body,
      },
    });
  }

  const shortlistSpec = [
    { vendor: "mill", status: "BOOKED" as const, contactName: "Dana Whitlock", contactEmail: "events@example.com", budgetItem: "Venue hire", notes: "Final headcount due 30 days out. Dana is the only one who answers the phone." },
    { vendor: "sage", status: "BOOKED" as const, contactName: "Marco Estevez", contactEmail: "marco@example.com", budgetItem: "Dinner service", notes: "Tasting done. Two gluten-free, one shellfish allergy to confirm." },
    { vendor: "lena", status: "BOOKED" as const, contactName: "Lena Prescott", contactEmail: "lena@example.com", budgetItem: "Photography package", notes: "Wants a shot list two weeks out." },
    { vendor: "fern", status: "QUOTED" as const, contactName: "Nadia Roux", contactEmail: "nadia@example.com", budgetItem: "Ceremony & reception florals", notes: "Over our line already. Ask whether the arch can be scaled back." },
    { vendor: "rivertones", status: "BOOKED" as const, contactName: "Errol Vance", contactEmail: "errol@example.com", budgetItem: "Band (4 hours)", notes: "Needs a 3m x 4m stage area and two power sockets." },
    { vendor: "hudson", status: "CONTACTED" as const, contactName: null, contactEmail: "hire@example.com", budgetItem: "Tables, chairs & linens", notes: "Deposit is three days overdue — chase this." },
    { vendor: "quarry", status: "DECLINED" as const, contactName: null, contactEmail: null, budgetItem: null, notes: "Beautiful, but the 10pm curfew killed it." },
  ];

  const shortlist = new Map<string, string>();
  for (const spec of shortlistSpec) {
    const created = await prisma.weddingVendor.create({
      data: {
        weddingId: wedding.id,
        vendorId: vendorIds.get(spec.vendor)!,
        status: spec.status,
        contactName: spec.contactName,
        contactEmail: spec.contactEmail,
        notes: spec.notes,
        budgetItemId: spec.budgetItem
          ? (budgetItems.get(spec.budgetItem) ?? null)
          : null,
        addedById: sam.id,
      },
    });
    shortlist.set(spec.vendor, created.id);
  }

  // Our own review of a vendor we have worked with, so the edit form has content.
  await prisma.vendorReview.create({
    data: {
      vendorId: vendorIds.get("lena")!,
      weddingId: wedding.id,
      authorId: alex.id,
      rating: 5,
      title: "Immediately at ease",
      body: "Engagement shoot was fun rather than awkward, which we did not expect.",
    },
  });

  console.log("Opening vendor threads…");

  /** The florist thread: mid-negotiation, with a quote attached and both sharing. */
  const fernThreadId = (
    await prisma.vendorThread.create({
      data: {
        weddingVendorId: shortlist.get("fern")!,
        subject: "Florals — revised quote",
        accessTokenHash: hashToken(FERN_TOKEN),
        accessGrantedAt: subDays(today, 9),
      },
      select: { id: true },
    })
  ).id;

  const quoteBytes = makePdf("Fern & Thistle — revised quote", [
    "Sam & Alex — ceremony & reception florals",
    "",
    "Ceremony arch, reduced scale",
    "Six long-table runners, garden style",
    "Twelve bud vases",
    "Two bridesmaid posies, one buttonhole set",
    "",
    "Delivery, install and next-day collection included.",
    "Valid for 14 days. Amounts as discussed by phone.",
  ]);

  const quoteKey = buildStorageKey(wedding.id, "application/pdf");
  await getStorage().put(quoteKey, quoteBytes, "application/pdf");
  const quoteUpload = await prisma.upload.create({
    data: {
      weddingId: wedding.id,
      storageKey: quoteKey,
      originalName: "fern-and-thistle-revised-quote.pdf",
      mimeType: "application/pdf",
      sizeBytes: quoteBytes.byteLength,
      createdById: null,
    },
  });

  const fernMessages = [
    {
      authorId: sam.id,
      authorName: null,
      body: "Hi Nadia — we loved the proposal but it lands over what we set aside for flowers. Is there a version where the arch is scaled back?",
      daysAgo: 9,
      uploadId: null as string | null,
    },
    {
      authorId: null,
      authorName: "Nadia Roux",
      body: "Of course. Half-arch on the left side only still reads well in photos and takes a good chunk out. Revised quote attached.",
      daysAgo: 8,
      uploadId: quoteUpload.id,
    },
    {
      authorId: alex.id,
      authorName: null,
      body: "That works for us. Sharing our mood board so you can see the palette we keep coming back to.",
      daysAgo: 7,
      uploadId: null,
    },
    {
      authorId: null,
      authorName: "Nadia Roux",
      body: "Perfect — the blush and cream is very doable in May. One question: what time can we get into the barn to install?",
      daysAgo: 2,
      uploadId: null,
    },
  ];

  let fernLast = today;
  for (const spec of fernMessages) {
    const createdAt = subDays(today, spec.daysAgo);
    await prisma.message.create({
      data: {
        threadId: fernThreadId,
        authorId: spec.authorId,
        authorName: spec.authorName,
        body: spec.body,
        createdAt,
        ...(spec.uploadId
          ? { attachments: { create: { uploadId: spec.uploadId } } }
          : {}),
      },
    });
    fernLast = createdAt;
  }

  await prisma.threadShare.create({
    data: {
      threadId: fernThreadId,
      moodBoardId: board.id,
      sharedById: alex.id,
      createdAt: subDays(today, 7),
    },
  });

  await prisma.threadShare.create({
    data: {
      threadId: fernThreadId,
      budgetItemId: budgetItems.get("Ceremony & reception florals")!,
      sharedById: alex.id,
      createdAt: subDays(today, 7),
    },
  });

  await prisma.vendorThread.update({
    where: { id: fernThreadId },
    data: {
      lastMessageAt: fernLast,
      // Nadia's last message is deliberately left unread, so the workspace shows
      // an unread badge on first load.
      coupleReadAt: subDays(today, 6),
      vendorReadAt: subDays(today, 2),
    },
  });

  // A settled thread, with nothing outstanding and no vendor link handed out.
  const millThreadId = (
    await prisma.vendorThread.create({
      data: {
        weddingVendorId: shortlist.get("mill")!,
        subject: "Timings & access",
      },
      select: { id: true },
    })
  ).id;

  await prisma.message.create({
    data: {
      threadId: millThreadId,
      authorId: sam.id,
      body: "Confirming we can start setting up from 10am on the day, and the shuttle can turn in the top yard.",
      createdAt: subDays(today, 21),
    },
  });

  await prisma.vendorThread.update({
    where: { id: millThreadId },
    data: {
      lastMessageAt: subDays(today, 21),
      coupleReadAt: subDays(today, 21),
    },
  });

  // --- guest contributions, itineraries, style & tours ----------------------
  console.log("Opening the gallery and guest book…");

  await prisma.weddingSite.update({
    where: { weddingId: wedding.id },
    data: {
      galleryEnabled: true,
      galleryNote:
        "Post anything from the day — most of these we'd never see otherwise.",
      guestBookEnabled: true,
      guestBookNote: "We'd rather hear your voice than read your handwriting.",
      // On, so the demo has a moderation queue to clear.
      moderateGuestPosts: true,
    },
  });

  const galleryStorage = getStorage();

  const gallerySpec = [
    { title: "first-look", colour: [214, 190, 178] as [number, number, number], w: 900, h: 600, by: "Priya", caption: "The look on your faces.", approved: true },
    { title: "long-table", colour: [176, 137, 104] as [number, number, number], w: 900, h: 600, by: "Devon", caption: "Nobody moved for three hours.", approved: true },
    { title: "sparklers", colour: [64, 58, 70] as [number, number, number], w: 600, h: 800, by: "Errol", caption: null, approved: true },
    // Deliberately left waiting, so the moderation queue is not empty.
    { title: "dance-floor", colour: [120, 96, 112] as [number, number, number], w: 900, h: 600, by: null, caption: "Sorry about the focus.", approved: false },
  ];

  for (const spec of gallerySpec) {
    const bytes = makePng(spec.w, spec.h, spec.colour);
    const storageKey = buildStorageKey(wedding.id, "image/png");
    await galleryStorage.put(storageKey, bytes, "image/png");

    const upload = await prisma.upload.create({
      data: {
        weddingId: wedding.id,
        storageKey,
        originalName: `${spec.title}.png`,
        mimeType: "image/png",
        sizeBytes: bytes.byteLength,
        width: spec.w,
        height: spec.h,
        createdById: null,
      },
    });

    await prisma.galleryPhoto.create({
      data: {
        weddingId: wedding.id,
        uploadId: upload.id,
        caption: spec.caption,
        uploaderName: spec.by,
        approvedAt: spec.approved ? subDays(today, 1) : null,
      },
    });
  }

  const voiceBytes = makeWav();
  const voiceKey = buildStorageKey(wedding.id, "audio/wav");
  await galleryStorage.put(voiceKey, voiceBytes, "audio/wav");
  const voiceUpload = await prisma.upload.create({
    data: {
      weddingId: wedding.id,
      storageKey: voiceKey,
      originalName: "a-message-for-you.wav",
      mimeType: "audio/wav",
      sizeBytes: voiceBytes.byteLength,
      createdById: null,
    },
  });

  await prisma.guestBookEntry.create({
    data: {
      weddingId: wedding.id,
      kind: "VOICE",
      guestName: "Nan",
      message: "She insisted on doing it out loud.",
      uploadId: voiceUpload.id,
      approvedAt: subDays(today, 1),
    },
  });

  for (const spec of [
    { name: "Priya Raman", message: "Fifteen years since you met at that awful party. Worth the wait.", approved: true },
    { name: "Marco Estevez", message: "You were right about the family style. Everyone stayed.", approved: true },
    // Waiting, like the pending photo.
    { name: "Someone at table 6", message: "GREAT WEDDING!!! whoever is reading this get the lemon cake", approved: false },
  ]) {
    await prisma.guestBookEntry.create({
      data: {
        weddingId: wedding.id,
        kind: "TEXT",
        guestName: spec.name,
        message: spec.message,
        approvedAt: spec.approved ? subDays(today, 1) : null,
      },
    });
  }

  console.log("Minting Pro unlock codes…");
  // The demo wedding's Pro came from somewhere. Recording the redemption that
  // bought it keeps the data honest — a plan with no history behind it is a flag
  // someone flipped, which is exactly what this design is trying not to be. This
  // one is spent, so its code is never printed.
  await prisma.unlockCode.create({
    data: {
      codeHash: hashToken(`demo-spent-${wedding.id}`),
      label: "Demo — redeemed by Sam & Alex",
      weddingId: wedding.id,
      redeemedAt: subDays(today, 210),
    },
  });
  // And one going spare, minted through the same function the CLI uses, so
  // redeeming can be tried end to end against a Free wedding.
  const spareUnlockCode = await mintUnlockCode("Demo — spare, unredeemed");

  console.log("Issuing itinerary links…");
  const itineraryTokens = new Map<string, string>();
  const namedGuests = await prisma.guest.findMany({
    where: { weddingId: wedding.id },
    select: { id: true, firstName: true, lastName: true, rsvp: { select: { status: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const guest of namedGuests) {
    const token = `demo-itinerary-${guest.id.slice(-8)}`;
    await prisma.guest.update({
      where: { id: guest.id },
      data: { itineraryTokenHash: hashToken(token) },
    });
    itineraryTokens.set(`${guest.firstName} ${guest.lastName}`.trim(), token);
  }

  // Pick an attending guest for the printed demo link, so it shows a full schedule.
  const demoGuest =
    namedGuests.find((guest) => guest.rsvp?.status === "ATTENDING") ??
    namedGuests[0];
  const demoItineraryToken = itineraryTokens.get(
    `${demoGuest.firstName} ${demoGuest.lastName}`.trim(),
  );

  console.log("Scoring the style quiz…");
  const styleAnswers = {
    venue: "barn",
    palette: "blush",
    formality: "garden-party",
    evening: "longdinner",
    light: "golden",
    splurge: "flowers",
  };
  await prisma.styleProfile.create({
    data: {
      weddingId: wedding.id,
      answers: styleAnswers,
      themes: scoreStyle(styleAnswers, { FLORALS: 1, DECOR: 1, VENUE: 1, CAKE: 1, STATIONERY: 1, ATTIRE: 1 }),
      // No summary: the seed does not call the model, and the scored themes are
      // the feature. Retake the quiz in the app with a key set to fill this in.
      summary: null,
      model: null,
    },
  });

  console.log("Adding a venue tour…");
  const panoBytes = makePng(2000, 500, [125, 132, 113], true);
  const panoKey = buildStorageKey(wedding.id, "image/png");
  await galleryStorage.put(panoKey, panoBytes, "image/png");
  const panoUpload = await prisma.upload.create({
    data: {
      weddingId: wedding.id,
      storageKey: panoKey,
      originalName: "the-old-mill-barn-360.png",
      mimeType: "image/png",
      sizeBytes: panoBytes.byteLength,
      width: 2000,
      height: 500,
      createdById: sam.id,
    },
  });

  await prisma.vendorMedia.create({
    data: {
      vendorId: vendorIds.get("mill")!,
      kind: "PANORAMA",
      uploadId: panoUpload.id,
      caption: "Standing in the barn doorway, looking round.",
      sortOrder: 0,
      createdById: sam.id,
    },
  });

  await prisma.vendorMedia.create({
    data: {
      vendorId: vendorIds.get("quarry")!,
      kind: "TOUR_URL",
      url: "https://example.com/tours/quarry-house",
      caption: "Their own walkthrough (a placeholder link in the demo).",
      sortOrder: 0,
      createdById: sam.id,
    },
  });

  const [taskCount, guestCount, seatedCount, moodCount, vendorCount, messageCount] =
    await Promise.all([
      prisma.task.count({ where: { weddingId: wedding.id } }),
      prisma.guest.count({ where: { weddingId: wedding.id } }),
      prisma.seatAssignment.count({
        where: { table: { weddingId: wedding.id } },
      }),
      prisma.moodBoardItem.count({ where: { boardId: board.id } }),
      prisma.weddingVendor.count({ where: { weddingId: wedding.id } }),
      prisma.message.count({
        where: { thread: { weddingVendor: { weddingId: wedding.id } } },
      }),
    ]);

  const [photoCount, entryCount] = await Promise.all([
    prisma.galleryPhoto.count({ where: { weddingId: wedding.id } }),
    prisma.guestBookEntry.count({ where: { weddingId: wedding.id } }),
  ]);

  console.log(`
Seeded "${wedding.title}" on the ${wedding.plan} plan — ${taskCount} tasks, ${guestCount} guests,
${seatedCount} seated across ${tableSpec.length} tables, ${moodCount} mood board images,
${vendorCount} vendors and ${messageCount} messages,
${photoCount} guest photos and ${entryCount} guest book entries (one of each awaiting approval).

  Public website:   /wedding/${site.slug}
  Guest photos:     /wedding/${site.slug}/gallery      (scan-and-post, no login)
  Guest book:       /wedding/${site.slug}/guestbook
  Florist's thread: /vendor/${FERN_TOKEN}
  ${demoGuest.firstName}'s itinerary: /itinerary/${demoItineraryToken}
                    (personal — shows only their own day, and where they RSVP)

  Spare Pro unlock code: ${spareUnlockCode}
                    (redeem it in Settings on a Free wedding — this one is
                     already Pro. Mint more with npm run plan:mint-code)

  Sign in with any of these (password: ${DEMO_PASSWORD})
    sam@example.com     owner
    alex@example.com    partner
    jamie@example.com   planner   (budget is view-only)
    robin@example.com   family    (budget and vendors hidden)
`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
