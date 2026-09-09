import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { moderateSubmissionSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; photoId: string }> };

/**
 * Approving or pulling a guest's photo.
 *
 * Approval and hiding are separate flags rather than one status, so un-hiding
 * something does not silently re-approve it and a pulled photo stays pulled even
 * if the couple later turns moderation off.
 */
export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, photoId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, moderateSubmissionSchema);

  const photo = await prisma.galleryPhoto.findFirst({
    where: { id: photoId, weddingId },
    select: { id: true },
  });
  if (!photo) throw notFound("That photo does not exist.");

  const updated = await prisma.galleryPhoto.update({
    where: { id: photo.id },
    data: {
      ...(input.approved !== undefined
        ? { approvedAt: input.approved ? new Date() : null }
        : {}),
      ...(input.hidden !== undefined
        ? { hiddenAt: input.hidden ? new Date() : null }
        : {}),
    },
    select: { id: true, approvedAt: true, hiddenAt: true },
  });

  broadcastChange(weddingId, "gallery", context.user.id);
  return ok({ photo: updated });
});

/** Deletes the row; the upload goes with it, and the bytes with that. */
export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, photoId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");

  const photo = await prisma.galleryPhoto.findFirst({
    where: { id: photoId, weddingId },
    select: { id: true, uploadId: true },
  });
  if (!photo) throw notFound("That photo does not exist.");

  // Deleting the upload cascades the gallery row with it.
  await prisma.upload.delete({ where: { id: photo.uploadId } });

  broadcastChange(weddingId, "gallery", context.user.id);
  return ok({ removed: true });
});
