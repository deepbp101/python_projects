import { ok, requireWorkspace, route } from "@/lib/api";
import {
  loadGalleryForCouple,
  loadGuestBookForCouple,
} from "@/lib/services/celebrations";
import { ensureSite } from "@/lib/services/site";

type Params = { params: Promise<{ weddingId: string }> };

/**
 * Everything the couple moderates: photos and guest book entries, including the
 * ones still waiting on them.
 *
 * The celebrations page reads these services directly as a server component.
 * The native app cannot, so the same three loads are served together — they are
 * always wanted together, and three round trips over a venue's wifi to render
 * one screen is three chances to fail.
 *
 * The site's flags come along because they are the answer to "why is this
 * empty": guests reach the gallery and guest book through the published site,
 * so an unpublished site means nothing can arrive.
 */
export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "WEBSITE", "VIEW");

  const [site, photos, entries] = await Promise.all([
    ensureSite(weddingId),
    loadGalleryForCouple(weddingId),
    loadGuestBookForCouple(weddingId),
  ]);

  return ok({
    photos,
    entries,
    site: {
      slug: site.slug,
      publishedAt: site.publishedAt,
      galleryEnabled: site.galleryEnabled,
      guestBookEnabled: site.guestBookEnabled,
      moderateGuestPosts: site.moderateGuestPosts,
    },
  });
});
