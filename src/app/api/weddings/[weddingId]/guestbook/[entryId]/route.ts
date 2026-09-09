import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { moderateSubmissionSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; entryId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, entryId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");
  const input = await parseBody(request, moderateSubmissionSchema);

  const entry = await prisma.guestBookEntry.findFirst({
    where: { id: entryId, weddingId },
    select: { id: true },
  });
  if (!entry) throw notFound("That entry does not exist.");

  const updated = await prisma.guestBookEntry.update({
    where: { id: entry.id },
    data: {
      ...(input.approved !== undefined
        ? { approvedAt: input.approved ? new Date() : null }
        : {}),
      ...(input.hidden !== undefined
        ? { hiddenAt: input.hidden ? new Date() : null }
        : {}),
    },
    select: { id: true, approvedAt: true, hiddenAt: true },
  });

  broadcastChange(weddingId, "guestbook", context.user.id);
  return ok({ entry: updated });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, entryId } = await params;
  const context = await requireWorkspace(weddingId, "WEBSITE", "EDIT");

  const entry = await prisma.guestBookEntry.findFirst({
    where: { id: entryId, weddingId },
    select: { id: true, uploadId: true },
  });
  if (!entry) throw notFound("That entry does not exist.");

  await prisma.guestBookEntry.delete({ where: { id: entry.id } });
  // A text entry has no recording to clean up.
  if (entry.uploadId) {
    await prisma.upload.delete({ where: { id: entry.uploadId } });
  }

  broadcastChange(weddingId, "guestbook", context.user.id);
  return ok({ removed: true });
});
