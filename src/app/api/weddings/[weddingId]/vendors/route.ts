import { badRequest, notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { loadShortlist, uniqueVendorSlug } from "@/lib/services/vendors";
import { addWeddingVendorSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "VENDORS", "VIEW");
  return ok({ vendors: await loadShortlist(weddingId) });
});

/**
 * Adds a vendor to this wedding's shortlist.
 *
 * Either picks an existing directory listing or creates one on the way through —
 * couples find most vendors themselves, and making them file a directory entry
 * first would just mean they never add anyone.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");
  const input = await parseBody(request, addWeddingVendorSchema);

  // The schema guarantees exactly one of the two is present.
  const vendorId = input.vendor
    ? (
        await prisma.vendor.create({
          data: {
            ...input.vendor,
            slug: await uniqueVendorSlug(input.vendor.name, input.vendor.city),
            createdById: context.user.id,
          },
          select: { id: true },
        })
      ).id
    : (
        await prisma.vendor.findUnique({
          where: { id: input.vendorId },
          select: { id: true },
        })
      )?.id;

  if (!vendorId) throw notFound("That vendor is not in the directory.");

  if (input.budgetItemId) {
    const item = await prisma.budgetItem.findFirst({
      where: { id: input.budgetItemId, weddingId },
      select: { id: true },
    });
    if (!item) throw badRequest("That budget line belongs to another wedding.");
  }

  const already = await prisma.weddingVendor.findUnique({
    where: { weddingId_vendorId: { weddingId, vendorId } },
    select: { id: true },
  });
  if (already) throw badRequest("That vendor is already on your list.");

  const shortlisted = await prisma.weddingVendor.create({
    data: {
      weddingId,
      vendorId,
      status: input.status,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      notes: input.notes ?? null,
      budgetItemId: input.budgetItemId ?? null,
      addedById: context.user.id,
    },
    include: { vendor: true },
  });

  broadcastChange(weddingId, "vendors", context.user.id);
  return ok({ vendor: shortlisted }, 201);
});
