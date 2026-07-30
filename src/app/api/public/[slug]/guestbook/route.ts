import { badRequest, notFound, ok, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { loadPublicContext } from "@/lib/services/celebrations";
import {
  readGuestForm,
  storeGuestRecording,
} from "@/lib/services/guest-uploads";
import { guestBookEntrySchema } from "@/lib/validation";

type Params = { params: Promise<{ slug: string }> };

/**
 * A guest book entry — written, spoken or filmed.
 *
 * Recordings go through the same byte-level checks as every other upload, and are
 * accepted only in audio and video formats: the guest book is not a general file
 * drop. A voice or video entry may carry a written note too, but does not have to.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { slug } = await params;

  const site = await loadPublicContext(slug);
  if (!site || !site.guestBookEnabled) {
    throw notFound("This guest book is not open.");
  }

  const { fields, file } = await readGuestForm(request);
  const input = guestBookEntrySchema.parse(fields);

  if (input.kind !== "TEXT" && !file) {
    throw badRequest("That entry has no recording attached.");
  }

  const upload =
    input.kind === "TEXT" || !file
      ? null
      : await storeGuestRecording(site.weddingId, file);

  const entry = await prisma.guestBookEntry.create({
    data: {
      weddingId: site.weddingId,
      kind: input.kind,
      guestName: input.guestName,
      message: input.message || null,
      uploadId: upload?.id ?? null,
      approvedAt: site.moderateGuestPosts ? null : new Date(),
    },
    select: { id: true, approvedAt: true },
  });

  broadcastChange(site.weddingId, "guestbook", null);

  return ok(
    { entry: { id: entry.id }, pending: entry.approvedAt === null },
    201,
  );
});
