import { forbidden, notFound, ok, parseBody, requireUser, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { loadVendorProfile } from "@/lib/services/vendors";
import { updateVendorSchema } from "@/lib/validation";

type Params = { params: Promise<{ vendorId: string }> };

/**
 * A directory listing, readable by any signed-in user — that is what makes the
 * ratings worth anything. Nothing here belongs to one wedding; the couple's own
 * status, notes and payments live on WeddingVendor and are not reachable from
 * this route.
 */
export const GET = route(async (_request: Request, { params }: Params) => {
  const { vendorId } = await params;
  await requireUser();

  const vendor = await loadVendorProfile(vendorId);
  if (!vendor) throw notFound("That vendor does not exist.");
  return ok({ vendor });
});

/**
 * Corrections to a listing are limited to whoever created it.
 *
 * A shared directory that anyone can rewrite is a directory anyone can vandalise,
 * and there is no moderation queue here to catch it. A couple who disagrees with
 * a listing can add their own review instead.
 */
export const PATCH = route(async (request: Request, { params }: Params) => {
  const { vendorId } = await params;
  const user = await requireUser();
  const input = await parseBody(request, updateVendorSchema);

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, createdById: true },
  });
  if (!vendor) throw notFound("That vendor does not exist.");
  if (vendor.createdById !== user.id) {
    throw forbidden("Only whoever added this listing can edit it.");
  }

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: input,
  });

  return ok({ vendor: updated });
});
