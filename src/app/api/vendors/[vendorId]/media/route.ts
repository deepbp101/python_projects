import {
  badRequest,
  forbidden,
  notFound,
  ok,
  parseBody,
  requireUser,
  route,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { vendorMediaSchema } from "@/lib/validation";

type Params = { params: Promise<{ vendorId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { vendorId } = await params;
  await requireUser();

  return ok({
    media: await prisma.vendorMedia.findMany({
      where: { vendorId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        kind: true,
        uploadId: true,
        url: true,
        caption: true,
        sortOrder: true,
      },
    }),
  });
});

/**
 * Adds media to a vendor's listing — photos, 360° panoramas, or a link to an
 * externally hosted walkthrough.
 *
 * Restricted to whoever created the listing, same as editing its details: a shared
 * directory anyone can add media to is a directory anyone can deface, and there is
 * no moderation queue here to catch it.
 *
 * A hosted panorama is an upload, which belongs to the wedding that posted it even
 * though the listing is shared. That is checked here — you cannot attach someone
 * else's file to a vendor.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { vendorId } = await params;
  const user = await requireUser();
  const input = await parseBody(request, vendorMediaSchema);

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, createdById: true },
  });
  if (!vendor) throw notFound("That vendor does not exist.");
  if (vendor.createdById !== user.id) {
    throw forbidden("Only whoever added this listing can add media to it.");
  }

  if (input.uploadId) {
    const upload = await prisma.upload.findFirst({
      where: {
        id: input.uploadId,
        wedding: {
          collaborators: { some: { userId: user.id, status: "ACTIVE" } },
        },
      },
      select: { id: true, mimeType: true },
    });
    if (!upload) throw badRequest("That file is not yours to attach.");
    if (!upload.mimeType.startsWith("image/")) {
      throw badRequest("Panoramas and photos need to be images.");
    }
  }

  const media = await prisma.vendorMedia.create({
    data: {
      vendorId: vendor.id,
      kind: input.kind,
      uploadId: input.uploadId ?? null,
      url: input.url ?? null,
      caption: input.caption ?? null,
      sortOrder: input.sortOrder,
      createdById: user.id,
    },
    select: { id: true, kind: true, uploadId: true, url: true, caption: true },
  });

  return ok({ media }, 201);
});
