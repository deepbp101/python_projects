import type { MoodCategory } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  scoreStyle,
  THEME_PROFILES,
  topThemes,
  type ScoredTheme,
} from "@/lib/domain/style";

/**
 * Style profile persistence.
 *
 * Answers and scored themes are both stored so the recommendations survive
 * without re-running anything: the scoring is deterministic, and the model's only
 * contribution is the summary paragraph.
 */

export async function loadStyleProfile(weddingId: string) {
  const profile = await prisma.styleProfile.findUnique({
    where: { weddingId },
  });
  if (!profile) return null;

  return {
    answers: (profile.answers ?? {}) as Record<string, string>,
    themes: (profile.themes ?? []) as ScoredTheme[],
    summary: profile.summary,
    model: profile.model,
    updatedAt: profile.updatedAt,
  };
}

/** How many mood board items sit in each category — a weak scoring signal. */
export async function loadMoodCounts(
  weddingId: string,
): Promise<Partial<Record<MoodCategory, number>>> {
  const board = await prisma.moodBoard.findUnique({
    where: { weddingId },
    select: { id: true },
  });
  if (!board) return {};

  const grouped = await prisma.moodBoardItem.groupBy({
    by: ["category"],
    where: { boardId: board.id },
    _count: { _all: true },
  });

  return Object.fromEntries(
    grouped.map((row) => [row.category, row._count._all]),
  );
}

export async function saveStyleProfile({
  weddingId,
  answers,
  themes,
  summary,
  model,
}: {
  weddingId: string;
  answers: Record<string, string>;
  themes: ScoredTheme[];
  summary: string | null;
  model: string | null;
}) {
  return prisma.styleProfile.upsert({
    where: { weddingId },
    create: { weddingId, answers, themes, summary, model },
    update: { answers, themes, summary, model },
  });
}

/**
 * Scores a set of answers against the couple's mood board in one call — the
 * shared path for both saving a new quiz and re-deriving an old one.
 */
export async function scoreForWedding(
  weddingId: string,
  answers: Record<string, string>,
) {
  const scored = scoreStyle(answers, await loadMoodCounts(weddingId));
  const leaders = topThemes(scored);

  return {
    scored,
    leaders,
    decor: leaders.flatMap((entry) => THEME_PROFILES[entry.theme].decor),
  };
}
