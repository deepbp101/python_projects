import { badRequest, notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { loadShortlistEntry } from "@/lib/services/vendors";
import { updateWeddingVendorSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; weddingVendorId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  await requireWorkspace(weddingId, "VENDORS", "VIEW");

  const vendor = await loadShortlistEntry(weddingId, weddingVendorId);
  if (!vendor) throw notFound("That vendor is not on your list.");
  return ok({ vendor });
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");
  const input = await parseBody(request, updateWeddingVendorSchema);

  const existing = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { id: true },
  });
  if (!existing) throw notFound("That vendor is not on your list.");

  if (input.budgetItemId) {
    const item = await prisma.budgetItem.findFirst({
      where: { id: input.budgetItemId, weddingId },
      select: { id: true },
    });
    if (!item) throw badRequest("That budget line belongs to another wedding.");
  }

  // `subject` belongs to the thread rather than the shortlist row, so it is
  // split out here instead of being passed straight through.
  const { subject, ...vendorFields } = input;

  const updated = await prisma.weddingVendor.update({
    where: { id: existing.id },
    data: vendorFields,
    select: { id: true },
  });

  if (subject !== undefined) {
    await prisma.vendorThread.upsert({
      where: { weddingVendorId: existing.id },
      create: { weddingVendorId: existing.id, subject },
      update: { subject },
    });
  }

  broadcastChange(weddingId, "vendors", context.user.id);
  return ok({ vendor: await loadShortlistEntry(weddingId, updated.id) });
});

/**
 * Removes a vendor from this wedding's list.
 *
 * The directory listing itself stays — other couples' reviews of that business
 * are not this couple's to delete. Cascades take the thread, its messages and
 * its shares, which also revokes the vendor's link.
 */
export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, weddingVendorId } = await params;
  const context = await requireWorkspace(weddingId, "VENDORS", "EDIT");

  const existing = await prisma.weddingVendor.findFirst({
    where: { id: weddingVendorId, weddingId },
    select: { id: true },
  });
  if (!existing) throw notFound("That vendor is not on your list.");

  await prisma.weddingVendor.delete({ where: { id: existing.id } });

  broadcastChange(weddingId, "vendors", context.user.id);
  return ok({ removed: true });
});
