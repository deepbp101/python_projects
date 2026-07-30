import { badRequest, notFound, ok, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { loadPublicContext } from "@/lib/services/celebrations";
import { readGuestForm, storeGuestPhoto } from "@/lib/services/guest-uploads";
import { galleryUploadSchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

/**
 * A guest posting a photo from the reception. No account, no token — the site
 * link they already have is the credential, which is the point: anything more is
 * something to explain at a wedding.
 *
 * Because that means anyone with the link can post, the couple's moderation
 * setting decides whether it appears immediately or waits for them. An
 * unpublished site, or one with the gallery switched off, is a flat 404.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { slug } = await params;

  const site = await loadPublicContext(slug);
  if (!site || !site.galleryEnabled) {
    throw notFound("This gallery is not open.");
  }

  const { fields, file } = await readGuestForm(request);
  if (!file) throw badRequest("Choose a photo to share.");

  const input = galleryUploadSchema.parse(fields);
  const uploadId = await storeGuestPhoto(site.weddingId, file);

  const photo = await prisma.galleryPhoto.create({
    data: {
      weddingId: site.weddingId,
      uploadId,
      caption: input.caption || null,
      uploaderName: input.uploaderName || null,
      // Auto-approved only when the couple has moderation off.
      approvedAt: site.moderateGuestPosts ? null : new Date(),
    },
    select: { id: true, approvedAt: true },
  });

  // No actor: every collaborator should see the new arrival.
  broadcastChange(site.weddingId, "gallery", null);

  return ok(
    {
      photo: { id: photo.id },
      pending: photo.approvedAt === null,
    },
    201,
  );
});
