import { prisma } from "@/lib/db";
import type { DraftContext } from "@/lib/ai/prompts";
import { formatLongDate } from "@/lib/dates";
import { THEME_PROFILES, type ScoredTheme } from "@/lib/domain/style";
import { topThemes } from "@/lib/domain/style";

/**
 * Grounding for the writing assistant.
 *
 * Everything the model is told about the wedding comes from here, so what it can
 * possibly know is a short, reviewable list — and the prompts instruct it not to
 * invent anything beyond it. Notably absent: guests, budget, vendors.
 */
export async function loadDraftContext(weddingId: string): Promise<DraftContext> {
  const wedding = await prisma.wedding.findUniqueOrThrow({
    where: { id: weddingId },
    select: {
      title: true,
      weddingDate: true,
      venueName: true,
      location: true,
      styleProfile: { select: { themes: true } },
    },
  });

  const scored = (wedding.styleProfile?.themes ?? []) as ScoredTheme[];

  return {
    coupleNames: wedding.title,
    weddingDate: formatLongDate(wedding.weddingDate),
    venueName: wedding.venueName,
    location: wedding.location,
    themes: topThemes(scored).map(
      (entry) => THEME_PROFILES[entry.theme].label,
    ),
  };
}

export async function loadDrafts(weddingId: string) {
  return prisma.aiDraft.findMany({
    where: { weddingId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      title: true,
      prompt: true,
      content: true,
      model: true,
      createdAt: true,
      createdBy: { select: { name: true } },
    },
  });
}
