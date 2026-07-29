import {
  badRequest,
  notFound,
  ok,
  parseBody,
  requireWorkspace,
  route,
} from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateSeatingTableSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; tableId: string }> };

/** Moving, renaming and resizing a table all land here; dragging sends x/y. */
export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, tableId } = await params;
  const context = await requireWorkspace(weddingId, "SEATING", "EDIT");
  const input = await parseBody(request, updateSeatingTableSchema);

  const existing = await prisma.seatingTable.findFirst({
    where: { id: tableId, weddingId },
    include: { _count: { select: { assignments: true } } },
  });
  if (!existing) throw notFound("That table does not exist.");

  if (input.name && input.name !== existing.name) {
    const clash = await prisma.seatingTable.findFirst({
      where: { weddingId, name: input.name, id: { not: tableId } },
      select: { id: true },
    });
    if (clash) throw badRequest(`There is already a table called "${input.name}".`);
  }

  // Shrinking below the people already seated would silently hide guests.
  if (input.capacity !== undefined && input.capacity < existing._count.assignments) {
    throw badRequest(
      `${existing._count.assignments} guests are seated here — move some before shrinking the table.`,
    );
  }

  const table = await prisma.seatingTable.update({
    where: { id: tableId },
    data: input,
    include: { assignments: true },
  });

  broadcastChange(weddingId, "seating", context.user.id);
  return ok({ table });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, tableId } = await params;
  const context = await requireWorkspace(weddingId, "SEATING", "EDIT");

  // Assignments cascade, so the guests simply return to the unseated list.
  const { count } = await prisma.seatingTable.deleteMany({
    where: { id: tableId, weddingId },
  });
  if (count === 0) throw notFound("That table does not exist.");

  broadcastChange(weddingId, "seating", context.user.id);
  return ok({ ok: true });
});
