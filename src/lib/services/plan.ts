import { randomInt } from "node:crypto";
import type { Plan } from "@/generated/prisma/enums";
import { ApiError, badRequest } from "@/lib/api";
import { hashToken } from "@/lib/auth/tokens";
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
import {
  formatUnlockCode,
  looksLikeUnlockCode,
  normalizeUnlockCode,
  UNLOCK_ALPHABET,
  UNLOCK_GROUPS,
  UNLOCK_GROUP_SIZE,
} from "@/lib/domain/unlock";

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

/**
 * Mints a code. Returns the raw code once — only the hash is stored, so this is
 * the only moment it exists in readable form.
 *
 * `randomInt` rather than `randomBytes % length`: the alphabet is 32 characters
 * and 256 is a multiple of 32, so modulo would be uniform here by luck. Relying
 * on that breaks silently the day someone edits the alphabet.
 */
export async function mintUnlockCode(label?: string): Promise<string> {
  const body = Array.from(
    { length: UNLOCK_GROUPS * UNLOCK_GROUP_SIZE },
    () => UNLOCK_ALPHABET[randomInt(UNLOCK_ALPHABET.length)],
  ).join("");

  await prisma.unlockCode.create({
    data: { codeHash: hashToken(body), label: label ?? null },
  });

  return formatUnlockCode(body);
}

/** Raised when a code cannot be redeemed. 400, not 402 — this is a typo, not a limit. */
export class UnlockError extends ApiError {
  constructor(message: string) {
    super(400, message);
  }
}

/**
 * Redeems a code, unlocking Pro for one wedding, permanently.
 *
 * One-way and one-to-one, enforced by the database rather than by checking
 * first: the update is conditional on the code still being unredeemed, and
 * `weddingId` is unique on the table. Two people redeeming the same code at the
 * same moment therefore cannot both win, and a wedding cannot stack two codes.
 *
 * Redeeming is deliberately not reversible in the app. Refunds are a
 * conversation, not a button, and a button that silently revokes a couple's
 * paid features is worse than no button.
 */
export async function redeemUnlockCode(
  weddingId: string,
  input: string,
): Promise<{ plan: Plan; unlockedAt: Date }> {
  const body = normalizeUnlockCode(input);
  if (!looksLikeUnlockCode(body)) {
    throw new UnlockError(
      "That doesn't look like an unlock code. They look like WED-XXXX-XXXX-XXXX-XXXX.",
    );
  }

  const existing = await prisma.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: { plan: true, planUnlockedAt: true },
  });
  if (existing.plan === "PRO") {
    throw new UnlockError(
      "This wedding is already on Pro — there's nothing left to unlock. Keep the code for another couple.",
    );
  }

  const unlockedAt = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      // Conditional on redeemedAt still being null: this is what makes a second
      // redemption of the same code lose rather than double-count.
      const claimed = await tx.unlockCode.updateMany({
        where: { codeHash: hashToken(body), redeemedAt: null },
        data: { redeemedAt: unlockedAt, weddingId },
      });

      if (claimed.count === 0) {
        throw new UnlockError(
          "That code isn't valid, or it has already been used. Check it against what you were sent.",
        );
      }

      const wedding = await tx.wedding.update({
        where: { id: weddingId },
        data: { plan: "PRO", planUnlockedAt: unlockedAt },
        select: { plan: true, planUnlockedAt: true },
      });

      return { plan: wedding.plan, unlockedAt: wedding.planUnlockedAt! };
    });
  } catch (error) {
    // The unique index on weddingId is the last line of defence against two
    // codes landing on one wedding concurrently. Report it as what it is.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw badRequest("This wedding has already been unlocked.");
    }
    throw error;
  }
}

/** Plan, month-to-date usage and what is left — for the settings page. */
export async function loadPlanSummary(weddingId: string, now = new Date()) {
  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: { plan: true, planUnlockedAt: true },
  });
  const plan = wedding.plan;
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
    unlockedAt: wedding.planUnlockedAt,
    usage: {
      ...usage,
      allowance: definition.aiTokensPerMonth,
      remaining: tokensRemaining(plan, usage.used),
    },
    counts: Object.fromEntries(counts) as Record<CountableLimit, number>,
  };
}
