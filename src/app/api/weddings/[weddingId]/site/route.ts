import { badRequest, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureSite, siteSlugFrom } from "@/lib/services/site";
import { updateSiteSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "WEBSITE", "VIEW");
  return ok({ site: await ensureSite(weddingId) });
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, updateSiteSchema);

  const site = await ensureSite(weddingId);

  if (input.slug !== undefined) {
    // Normalised before the uniqueness check, so "Our Wedding" and
    // "our-wedding" cannot both be taken.
    const normalised = siteSlugFrom(input.slug);
    if (normalised !== site.slug) {
      const clash = await prisma.weddingSite.findUnique({
        where: { slug: normalised },
        select: { id: true },
      });
      if (clash && clash.id !== site.id) {
        throw badRequest("That web address is already taken. Try another.");
      }
    }
    input.slug = normalised;
  }

  if (input.coverUploadId) {
    const upload = await prisma.upload.findFirst({
      where: { id: input.coverUploadId, weddingId },
      select: { id: true },
    });
    if (!upload) throw badRequest("That image belongs to another wedding.");
  }

  const { rsvpDeadline, ...rest } = input;
  const updated = await prisma.weddingSite.update({
    where: { id: site.id },
    data: {
      ...rest,
      ...(rsvpDeadline !== undefined
        ? { rsvpDeadline: rsvpDeadline ? new Date(rsvpDeadline) : null }
        : {}),
    },
    include: {
      events: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] },
      registry: { orderBy: { sortOrder: "asc" } },
      coverImage: true,
    },
  });

  broadcastChange(weddingId, "site", context.user.id);
  return ok({ site: updated });
});
