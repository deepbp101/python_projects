import type { GuestBookKind } from "@/generated/prisma/enums";

/**
 * Visibility rules for anything a guest submitted — gallery photos and guest book
 * entries alike. Pure, because "who can see this" is the part that must not be
 * subtly wrong, and it is shared by the public page and the workspace.
 */

export const GUEST_BOOK_KIND_LABELS: Record<GuestBookKind, string> = {
  TEXT: "Written",
  VOICE: "Voice note",
  VIDEO: "Video",
};

export const MAX_GUEST_NAME = 80;
export const MAX_GUEST_MESSAGE = 2000;
export const MAX_CAPTION = 300;

export type Moderatable = {
  approvedAt: Date | string | null;
  hiddenAt: Date | string | null;
};

/**
 * Whether a submission shows on the public page.
 *
 * Hidden always wins — the couple taking something down is final regardless of
 * whether moderation is on. With moderation on, a submission needs explicit
 * approval; with it off, anything not hidden is live. Note the asymmetry is
 * deliberate: turning moderation *off* publishes the existing queue, which is
 * what "I trust this crowd after all" should mean.
 */
export function isPubliclyVisible(
  item: Moderatable,
  moderate: boolean,
): boolean {
  if (item.hiddenAt) return false;
  return moderate ? item.approvedAt !== null : true;
}

/** What the couple sees in the workspace: how much is live, waiting, or pulled. */
export function summarizeContributions<T extends Moderatable>(
  items: T[],
  moderate: boolean,
): { total: number; visible: number; pending: number; hidden: number } {
  let visible = 0;
  let pending = 0;
  let hidden = 0;

  for (const item of items) {
    if (item.hiddenAt) hidden += 1;
    else if (isPubliclyVisible(item, moderate)) visible += 1;
    else pending += 1;
  }

  return { total: items.length, visible, pending, hidden };
}
