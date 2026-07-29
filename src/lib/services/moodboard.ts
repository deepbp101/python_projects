import type { Prisma } from "@/generated/prisma/client";
import { hashToken } from "@/lib/auth/tokens";
import { prisma } from "@/lib/db";
import {
  MOOD_CATEGORIES,
  MOOD_CATEGORY_LABELS,
} from "@/lib/domain/moodboard";

export { MOOD_CATEGORIES, MOOD_CATEGORY_LABELS };

const boardInclude = {
  items: {
    include: { upload: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.MoodBoardInclude;

/** Created on first visit, so a couple who never opens it never gets an empty board. */
export async function ensureMoodBoard(weddingId: string) {
  const existing = await prisma.moodBoard.findUnique({
    where: { weddingId },
    include: boardInclude,
  });
  if (existing) return existing;

  await prisma.moodBoard.create({ data: { weddingId } });
  return prisma.moodBoard.findUniqueOrThrow({
    where: { weddingId },
    include: boardInclude,
  });
}

/**
 * Loads a board by share token. Returns null for an unknown or revoked token,
 * so a withdrawn link stops working immediately.
 */
export async function loadSharedBoard(token: string) {
  return prisma.moodBoard.findFirst({
    where: { shareTokenHash: hashToken(token) },
    include: {
      ...boardInclude,
      wedding: { select: { title: true, weddingDate: true } },
    },
  });
}
