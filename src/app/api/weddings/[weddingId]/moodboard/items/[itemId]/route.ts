import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { getStorage } from "@/lib/storage";
import { updateMoodItemSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; itemId: string }> };

const scoped = (itemId: string, weddingId: string) => ({
  id: itemId,
  board: { weddingId },
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, itemId } = await params;
  const context = await requireWorkspace(weddingId, "MOODBOARD", "EDIT");
  const input = await parseBody(request, updateMoodItemSchema);

  const existing = await prisma.moodBoardItem.findFirst({
    where: scoped(itemId, weddingId),
    select: { id: true },
  });
  if (!existing) throw notFound("That mood board item does not exist.");

  const item = await prisma.moodBoardItem.update({
    where: { id: itemId },
    data: input,
    include: { upload: true },
  });

  broadcastChange(weddingId, "moodboard", context.user.id);
  return ok({ item });
});

/** Deleting an item also removes the stored file — nothing is left orphaned. */
export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, itemId } = await params;
  const context = await requireWorkspace(weddingId, "MOODBOARD", "EDIT");

  const item = await prisma.moodBoardItem.findFirst({
    where: scoped(itemId, weddingId),
    include: { upload: true },
  });
  if (!item) throw notFound("That mood board item does not exist.");

  await prisma.moodBoardItem.delete({ where: { id: itemId } });

  if (item.upload) {
    // Row first, bytes second: a failed delete here leaves an unreferenced
    // file, which is recoverable. The reverse would leave a broken image.
    await prisma.upload.delete({ where: { id: item.upload.id } });
    await getStorage()
      .delete(item.upload.storageKey)
      .catch((error) => console.error("Failed to remove stored file:", error));
  }

  broadcastChange(weddingId, "moodboard", context.user.id);
  return ok({ ok: true });
});
