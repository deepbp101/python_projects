import { forbidden, notFound, ok, requireUser, route } from "@/lib/api";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ vendorId: string; mediaId: string }> };

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { vendorId, mediaId } = await params;
  const user = await requireUser();

  const media = await prisma.vendorMedia.findFirst({
    where: { id: mediaId, vendorId },
    select: { id: true, uploadId: true, vendor: { select: { createdById: true } } },
  });
  if (!media) throw notFound("That media does not exist.");
  if (media.vendor.createdById !== user.id) {
    throw forbidden("Only whoever added this listing can change its media.");
  }

  await prisma.vendorMedia.delete({ where: { id: media.id } });
  // A linked tour has no bytes of ours to clean up.
  if (media.uploadId) {
    await prisma.upload.delete({ where: { id: media.uploadId } });
  }

  return ok({ removed: true });
});
