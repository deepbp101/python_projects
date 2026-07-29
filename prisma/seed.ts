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
import { makePng } from "./seed-images";
import { hashPassword } from "@/lib/auth/password";
import { addDays, startOfUtcDay, subDays } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { siteSlugFrom } from "@/lib/domain/site";
import { generateTimeline } from "@/lib/domain/timeline";
import { defaultPermissionsForRole } from "@/lib/permissions";
import { slugify } from "@/lib/services/wedding";
import { buildStorageKey, getStorage } from "@/lib/storage";

const DEMO_PASSWORD = "wedding-demo-2026";

const today = startOfUtcDay(new Date());
const weddingDate = addDays(today, 243); // roughly eight months out

const money = (dollars: number) => Math.round(dollars * 100);

async function main() {
  console.log("Clearing existing data…");
  // Order matters only for users; everything else cascades from Wedding.
  await prisma.wedding.deleteMany({});
  await prisma.user.deleteMany({});
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
      currency: "USD",
      totalBudget: money(42_000),
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

  for (const spec of itemSpec) {
    const categoryId = categories.get(spec.category);
    if (!categoryId) throw new Error(`Unknown category: ${spec.category}`);

    await prisma.budgetItem.create({
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
            startsAt: new Date(weddingDate.getTime() + 15 * 60 * 60 * 1000),
            venueName: "The Old Mill, riverside lawn",
            address: "112 Mill Road, Beacon, NY 12508",
            description: "Seats from 2:30pm. It's grass — bring sensible shoes.",
            dressCode: "Garden formal",
            sortOrder: 0,
          },
          {
            name: "Drinks & dinner",
            startsAt: new Date(weddingDate.getTime() + 17 * 60 * 60 * 1000),
            venueName: "The Old Mill, barn",
            address: "112 Mill Road, Beacon, NY 12508",
            description: "Dinner at 6:30pm, dancing until late.",
            sortOrder: 1,
          },
          {
            name: "Farewell brunch",
            startsAt: new Date(
              addDays(weddingDate, 1).getTime() + 10 * 60 * 60 * 1000,
            ),
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

  const [taskCount, guestCount, seatedCount, moodCount] = await Promise.all([
    prisma.task.count({ where: { weddingId: wedding.id } }),
    prisma.guest.count({ where: { weddingId: wedding.id } }),
    prisma.seatAssignment.count({
      where: { table: { weddingId: wedding.id } },
    }),
    prisma.moodBoardItem.count({ where: { boardId: board.id } }),
  ]);

  console.log(`
Seeded "${wedding.title}" — ${taskCount} tasks, ${guestCount} guests,
${seatedCount} seated across ${tableSpec.length} tables, ${moodCount} mood board images.

  Public website: /wedding/${site.slug}

  Sign in with any of these (password: ${DEMO_PASSWORD})
    sam@example.com     owner
    alex@example.com    partner
    jamie@example.com   planner   (budget is view-only)
    robin@example.com   family    (budget hidden)
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
