import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { vendorReviewSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

/**
 * Writes this wedding's review of a vendor.
 *
 * Reviewing goes through the shortlist rather than the directory, which means a
 * couple can only rate a vendor they have actually dealt with — the cheapest
 * available defence against a directory full of drive-by ratings. One review per
 * wedding per vendor, enforced by a unique index, so this is an upsert: editing
 * your review replaces it instead of adding another star rating.
 */
export const PUT = route(async (request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");
  const input = await parseBody(request, vendorReviewSchema);

  const entry = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { vendorId: true },
  });
  if (!entry) throw notFound("That vendor is not on your list.");

  const review = await prisma.vendorReview.upsert({
    where: {
      vendorId_weddingId: { vendorId: entry.vendorId, weddingId },
    },
    create: {
      vendorId: entry.vendorId,
      weddingId,
      authorId: context.user.id,
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
    },
    update: {
      rating: input.rating,
      title: input.title ?? null,
      body: input.body ?? null,
      authorId: context.user.id,
    },
  });

  broadcastChange(weddingId, "vendors", context.user.id);
  return ok({ review });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");

  const entry = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { vendorId: true },
  });
  if (!entry) throw notFound("That vendor is not on your list.");

  await prisma.vendorReview.deleteMany({
    where: { vendorId: entry.vendorId, weddingId },
  });

  broadcastChange(weddingId, "vendors", context.user.id);
  return ok({ removed: true });
});
