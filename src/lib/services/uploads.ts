import { hashToken } from "@/lib/auth/tokens";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasAccess } from "@/lib/permissions";

/**
 * Who may read a stored file.
 *
 * There are exactly three ways in, and a request has to satisfy one of them:
 *   1. an active collaborator with at least VIEW on the relevant section;
 *   2. a valid mood board share token, for images on that board;
 *   3. the cover image of a published wedding website, which is public by
 *      definition.
 */
export type UploadAccess = { allowed: boolean; isPublic: boolean };

export async function resolveUploadAccess(
  uploadId: string,
  shareToken: string | null,
): Promise<(UploadAccess & { storageKey: string; mimeType: string }) | null> {
  const upload = await prisma.upload.findUnique({
    where: { id: uploadId },
    include: {
      moodBoardItem: { include: { board: true } },
      siteCoverFor: { select: { publishedAt: true } },
    },
  });
  if (!upload) return null;

  const base = { storageKey: upload.storageKey, mimeType: upload.mimeType };

  // 3. Cover image of a published site.
  if (upload.siteCoverFor?.publishedAt) {
    return { ...base, allowed: true, isPublic: true };
  }

  // 2. Shared mood board.
  const board = upload.moodBoardItem?.board;
  if (shareToken && board?.shareTokenHash === hashToken(shareToken)) {
    return { ...base, allowed: true, isPublic: true };
  }

  // 1. Workspace member.
  const user = await getCurrentUser();
  if (!user) return { ...base, allowed: false, isPublic: false };

  const collaborator = await prisma.collaborator.findFirst({
    where: { weddingId: upload.weddingId, userId: user.id, status: "ACTIVE" },
    include: { permissions: true },
  });
  if (!collaborator) return { ...base, allowed: false, isPublic: false };

  // An image is gated by whatever it is being used for; an unattached upload
  // (just posted, not yet saved to an item) falls back to the mood board.
  const section = upload.siteCoverFor ? "WEBSITE" : "MOODBOARD";
  const allowed = hasAccess(
    collaborator.role,
    collaborator.permissions,
    section,
    "VIEW",
  );

  return { ...base, allowed, isPublic: false };
}
