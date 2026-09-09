import { badRequest, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureSite } from "@/lib/services/site";
import { publishSiteSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Publishing is what makes /wedding/[slug] reachable. Unpublishing takes it
 * offline again without losing anything the couple has written.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const { published } = await parseBody(request, publishSiteSchema);

  const site = await ensureSite(weddingId);

  // Publishing a site with no headline and no events would put an empty page
  // in front of guests.
  if (published && !site.headline?.trim() && site.events.length === 0) {
    throw badRequest("Add a headline or an event before publishing.");
  }

  const updated = await prisma.weddingSite.update({
    where: { id: site.id },
    data: { publishedAt: published ? (site.publishedAt ?? new Date()) : null },
    select: { slug: true, publishedAt: true },
  });

  broadcastChange(weddingId, "site", context.user.id);
  return ok({
    published: updated.publishedAt !== null,
    url: `${process.env.APP_URL ?? "http://localhost:3000"}/wedding/${updated.slug}`,
  });
});
