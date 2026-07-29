import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { defaultCategoriesFor } from "@/lib/domain/budget";
import { generateTimeline } from "@/lib/domain/timeline";

/** URL-safe slug for the workspace, with a short suffix to keep it unique. */
export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 48);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "wedding"}-${suffix}`;
}

export const DEFAULT_GUEST_TAGS = [
  { name: "Family", color: "#8C6E63" },
  { name: "Friends", color: "#6B7F6E" },
  { name: "Work", color: "#6E7B8B" },
  { name: "Wedding party", color: "#B9868B" },
];

export const DEFAULT_MEAL_OPTIONS = [
  { name: "Chicken", description: "Herb-roasted chicken", sortOrder: 0 },
  { name: "Beef", description: "Braised short rib", sortOrder: 1 },
  { name: "Fish", description: "Pan-seared seasonal fish", sortOrder: 2 },
  { name: "Vegetarian", description: "Seasonal vegetable plate", sortOrder: 3 },
];

export type CreateWeddingInput = {
  title: string;
  weddingDate: Date;
  venueName?: string | null;
  location?: string | null;
  timezone?: string;
  currency?: string;
  totalBudget?: number;
  seedTimeline?: boolean;
  seedBudget?: boolean;
};

/**
 * Creates a workspace with its owner, and optionally pre-fills the checklist
 * and budget so a new couple lands on something useful rather than empty pages.
 *
 * Runs in a transaction: a half-created workspace would leave the owner unable
 * to reach their own wedding.
 */
export async function createWedding(
  userId: string,
  input: CreateWeddingInput,
) {
  const {
    seedTimeline = true,
    seedBudget = true,
    totalBudget = 0,
    ...rest
  } = input;

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  return prisma.$transaction(async (tx) => {
    const wedding = await tx.wedding.create({
      data: {
        slug: slugify(rest.title),
        title: rest.title,
        weddingDate: rest.weddingDate,
        venueName: rest.venueName ?? null,
        location: rest.location ?? null,
        timezone: rest.timezone ?? "UTC",
        currency: rest.currency ?? "USD",
        totalBudget,
      },
    });

    await tx.collaborator.create({
      data: {
        weddingId: wedding.id,
        userId,
        email: user.email,
        name: user.name,
        role: "OWNER",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    });

    if (seedTimeline) {
      const tasks = generateTimeline(rest.weddingDate);
      await tx.task.createMany({
        data: tasks.map((task) => ({
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
    }

    if (seedBudget && totalBudget > 0) {
      await tx.budgetCategory.createMany({
        data: defaultCategoriesFor(totalBudget).map((category) => ({
          weddingId: wedding.id,
          ...category,
        })),
      });
    }

    await tx.guestTag.createMany({
      data: DEFAULT_GUEST_TAGS.map((tag) => ({
        weddingId: wedding.id,
        ...tag,
      })),
    });

    await tx.mealOption.createMany({
      data: DEFAULT_MEAL_OPTIONS.map((meal) => ({
        weddingId: wedding.id,
        ...meal,
      })),
    });

    return wedding;
  });
}

/** Weddings the user is an active collaborator on, soonest first. */
export async function listWeddingsForUser(userId: string) {
  const memberships = await prisma.collaborator.findMany({
    where: { userId, status: "ACTIVE" },
    include: {
      wedding: {
        include: {
          _count: { select: { guests: true, tasks: true } },
        },
      },
    },
    orderBy: { wedding: { weddingDate: "asc" } },
  });

  return memberships.map((membership) => ({
    ...membership.wedding,
    role: membership.role,
  }));
}
