import { badRequest, notFound, ok, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { hasFeature, planDefinition } from "@/lib/domain/plans";
import { guardGuestPost, pruneOldWindows } from "@/lib/rate-limit";
import { broadcastChange } from "@/lib/realtime/emit";
import { loadPublicContext } from "@/lib/services/celebrations";
import {
  readGuestForm,
  storeGuestRecording,
} from "@/lib/services/guest-uploads";
import { loadPlan, PlanLimitError, requireCapacity } from "@/lib/services/plan";
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

  const plan = await loadPlan(site.weddingId);
  await guardGuestPost(
    request,
    site.weddingId,
    planDefinition(plan).guestPostsPerDay,
  );
  await requireCapacity(site.weddingId, "guestBookEntries", "guest book entries");

  const { fields, file } = await readGuestForm(request);
  const input = guestBookEntrySchema.parse(fields);

  if (input.kind !== "TEXT" && !file) {
    throw badRequest("That entry has no recording attached.");
  }

  // Recordings cost real storage, so they are the part a plan gates. The message
  // is written for the guest, who did not choose the couple's plan and should not
  // be shown an upgrade pitch.
  if (input.kind !== "TEXT" && !hasFeature(plan, "guestBookRecordings")) {
    throw new PlanLimitError(
      "This guest book is taking written messages only. Leave them a note instead.",
      { feature: "guestBookRecordings" },
    );
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
  void pruneOldWindows().catch(() => {});

  return ok(
    { entry: { id: entry.id }, pending: entry.approvedAt === null },
    201,
  );
});
