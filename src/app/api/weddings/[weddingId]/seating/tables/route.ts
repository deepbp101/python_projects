import { badRequest, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { createSeatingTableSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "SEATING", "EDIT");
  const input = await parseBody(request, createSeatingTableSchema);

  const clash = await prisma.seatingTable.findFirst({
    where: { weddingId, name: input.name },
    select: { id: true },
  });
  if (clash) throw badRequest(`There is already a table called "${input.name}".`);

  const table = await prisma.seatingTable.create({
    data: { weddingId, ...input },
    include: { assignments: true },
  });

  broadcastChange(weddingId, "seating", context.user.id);
  return ok({ table }, 201);
});
