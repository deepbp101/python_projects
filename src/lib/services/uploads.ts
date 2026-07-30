import { hashToken } from "@/lib/auth/tokens";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasAccess } from "@/lib/permissions";

/**
 * Who may read a stored file.
 *
 * There are exactly four ways in, and a request has to satisfy one of them:
 *   1. an active collaborator with at least VIEW on the relevant section;
 *   2. a valid mood board share token, for images on that board;
 *   3. a valid vendor thread token, for files sent in that thread and for images
 *      on a mood board shared into it;
 *   4. the cover image of a published wedding website, which is public by
 *      definition.
 *
 * Tokens 2 and 3 arrive in the same `?share=` parameter, so a caller does not
 * have to know which kind of link it is holding.
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
      attachedTo: { select: { message: { select: { threadId: true } } } },
    },
  });
  if (!upload) return null;

  const base = { storageKey: upload.storageKey, mimeType: upload.mimeType };

  // 4. Cover image of a published site.
  if (upload.siteCoverFor?.publishedAt) {
    return { ...base, allowed: true, isPublic: true };
  }

  const board = upload.moodBoardItem?.board;

  // 2. Shared mood board.
  if (shareToken && board?.shareTokenHash === hashToken(shareToken)) {
    return { ...base, allowed: true, isPublic: true };
  }

  // 3. Vendor holding a thread link. Their files and anything shared into the
  // thread, and nothing else in the workspace.
  if (shareToken) {
    const thread = await prisma.vendorThread.findFirst({
      where: { accessTokenHash: hashToken(shareToken) },
      select: { id: true },
    });

    if (thread) {
      const sentInThisThread =
        upload.attachedTo?.message.threadId === thread.id;

      const sharedIntoThisThread =
        board !== undefined &&
        board !== null &&
        (await prisma.threadShare.findFirst({
          where: {
            threadId: thread.id,
            moodBoardId: board.id,
            revokedAt: null,
          },
          select: { id: true },
        })) !== null;

      if (sentInThisThread || sharedIntoThisThread) {
        // Not `public`: a thread link is per-vendor and revocable, so shared
        // caches must not hold onto the bytes.
        return { ...base, allowed: true, isPublic: false };
      }
    }
  }

  // 1. Workspace member.
  const user = await getCurrentUser();
  if (!user) return { ...base, allowed: false, isPublic: false };

  const collaborator = await prisma.collaborator.findFirst({
    where: { weddingId: upload.weddingId, userId: user.id, status: "ACTIVE" },
    include: { permissions: true },
  });
  if (!collaborator) return { ...base, allowed: false, isPublic: false };

  // A file is gated by whatever it is being used for; an unattached upload
  // (just posted, not yet saved to an item) falls back to the mood board.
  const section = upload.siteCoverFor
    ? "WEBSITE"
    : upload.attachedTo
      ? "VENDORS"
      : "MOODBOARD";

  const allowed = hasAccess(
    collaborator.role,
    collaborator.permissions,
    section,
    "VIEW",
  );

  return { ...base, allowed, isPublic: false };
}
