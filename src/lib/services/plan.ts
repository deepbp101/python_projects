import type { Plan } from "@/generated/prisma/enums";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  featureMessage,
  fitsWithinLimit,
  limitMessage,
  planDefinition,
  remainingOf,
  tokensRemaining,
  usagePeriod,
  type CountableLimit,
  type PlanFeature,
} from "@/lib/domain/plans";

/**
 * Enforcement for plan limits.
 *
 * 402 rather than 403: the caller is who they say they are and is allowed to do
 * this in principle — the workspace just is not paying for it. A client can key
 * off the status to show an upgrade prompt rather than an access error.
 */
export class PlanLimitError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(402, message, details);
  }
}

export async function loadPlan(weddingId: string): Promise<Plan> {
  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: { plan: true },
  });
  return wedding.plan;
}

/** Live count of whatever a limit governs. */
export async function currentCount(
  weddingId: string,
  limit: CountableLimit,
): Promise<number> {
  switch (limit) {
    case "guests":
      return prisma.guest.count({ where: { weddingId } });
    case "collaborators":
      // The couple are not billed as collaborators; invited helpers are.
      return prisma.collaborator.count({
        where: {
          weddingId,
          status: { not: "REMOVED" },
          role: { in: ["PLANNER", "FAMILY"] },
        },
      });
    case "vendors":
      return prisma.weddingVendor.count({ where: { weddingId } });
    case "moodBoardItems":
      return prisma.moodBoardItem.count({
        where: { board: { weddingId } },
      });
    case "galleryPhotos":
      return prisma.galleryPhoto.count({ where: { weddingId } });
    case "guestBookEntries":
      return prisma.guestBookEntry.count({ where: { weddingId } });
    case "seatingTables":
      return prisma.seatingTable.count({ where: { weddingId } });
    case "aiDrafts":
      return prisma.aiDraft.count({ where: { weddingId } });
  }
}

/**
 * Refuses when adding `adding` more would exceed the plan.
 *
 * Checked as a whole rather than per row, so a bulk import that would overshoot
 * is rejected outright instead of being applied halfway.
 */
export async function requireCapacity(
  weddingId: string,
  limit: CountableLimit,
  noun: string,
  adding = 1,
): Promise<void> {
  const plan = await loadPlan(weddingId);
  const current = await currentCount(weddingId, limit);

  if (!fitsWithinLimit(plan, limit, current, adding)) {
    throw new PlanLimitError(limitMessage(plan, limit, noun), {
      limit,
      plan,
      current,
      remaining: remainingOf(plan, limit, current),
    });
  }
}

export async function requireFeature(
  weddingId: string,
  feature: PlanFeature,
): Promise<void> {
  const plan = await loadPlan(weddingId);
  if (!planDefinition(plan).features[feature]) {
    throw new PlanLimitError(featureMessage(feature), { feature, plan });
  }
}

/** Tokens this wedding has spent in the current calendar month. */
export async function loadAiUsage(weddingId: string, now = new Date()) {
  const period = usagePeriod(now);
  const row = await prisma.aiUsage.findUnique({
    where: { weddingId_period: { weddingId, period } },
    select: { inputTokens: true, outputTokens: true, requests: true },
  });

  const used = (row?.inputTokens ?? 0) + (row?.outputTokens ?? 0);
  return {
    period,
    used,
    requests: row?.requests ?? 0,
    inputTokens: row?.inputTokens ?? 0,
    outputTokens: row?.outputTokens ?? 0,
  };
}

/**
 * Records what a request actually cost.
 *
 * Counts the API's reported usage rather than the requested `max_tokens`, because
 * a generation that stops early costs less and the meter should agree with the
 * bill. Written after the call, so a failed request is not charged.
 */
export async function recordAiUsage(
  weddingId: string,
  usage: { inputTokens: number; outputTokens: number },
  now = new Date(),
): Promise<void> {
  const period = usagePeriod(now);

  await prisma.aiUsage.upsert({
    where: { weddingId_period: { weddingId, period } },
    create: {
      weddingId,
      period,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      requests: 1,
    },
    update: {
      inputTokens: { increment: usage.inputTokens },
      outputTokens: { increment: usage.outputTokens },
      requests: { increment: 1 },
    },
  });
}

/** Plan, month-to-date usage and what is left — for the settings page. */
export async function loadPlanSummary(weddingId: string, now = new Date()) {
  const plan = await loadPlan(weddingId);
  const usage = await loadAiUsage(weddingId, now);
  const definition = planDefinition(plan);

  const counts = await Promise.all(
    (
      [
        "guests",
        "collaborators",
        "vendors",
        "moodBoardItems",
        "galleryPhotos",
        "guestBookEntries",
        "seatingTables",
        "aiDrafts",
      ] as CountableLimit[]
    ).map(async (limit) => [limit, await currentCount(weddingId, limit)] as const),
  );

  return {
    plan,
    usage: {
      ...usage,
      allowance: definition.aiTokensPerMonth,
      remaining: tokensRemaining(plan, usage.used),
    },
    counts: Object.fromEntries(counts) as Record<CountableLimit, number>,
  };
}
