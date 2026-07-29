import { badRequest, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { ensureMoodBoard } from "@/lib/services/moodboard";
import { createMoodItemSchema, updateMoodBoardSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "MOODBOARD", "VIEW");
  return ok({ board: await ensureMoodBoard(weddingId) });
});

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "MOODBOARD", "EDIT");
  const input = await parseBody(request, updateMoodBoardSchema);

  const board = await ensureMoodBoard(weddingId);
  const updated = await prisma.moodBoard.update({
    where: { id: board.id },
    data: input,
  });

  broadcastChange(weddingId, "moodboard", context.user.id);
  return ok({ board: updated });
});

/** Adds an image to the board. */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "MOODBOARD", "EDIT");
  const input = await parseBody(request, createMoodItemSchema);

  if (input.uploadId) {
    const upload = await prisma.upload.findFirst({
      where: { id: input.uploadId, weddingId },
      select: { id: true, moodBoardItem: { select: { id: true } } },
    });
    if (!upload) throw badRequest("That image belongs to another wedding.");
    if (upload.moodBoardItem) {
      throw badRequest("That image is already on the board.");
    }
  }

  const board = await ensureMoodBoard(weddingId);
  const item = await prisma.moodBoardItem.create({
    data: {
      boardId: board.id,
      uploadId: input.uploadId ?? null,
      category: input.category,
      title: input.title ?? null,
      note: input.note ?? null,
      sourceUrl: input.sourceUrl ?? null,
      sortOrder: board.items.length,
      createdById: context.user.id,
    },
    include: { upload: true },
  });

  broadcastChange(weddingId, "moodboard", context.user.id);
  return ok({ item }, 201);
});
