import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updateHouseholdSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; householdId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, householdId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");
  const input = await parseBody(request, updateHouseholdSchema);

  const existing = await prisma.household.findFirst({
    where: { id: householdId, weddingId },
  });
  if (!existing) throw notFound("That household does not exist.");

  const household = await prisma.household.update({
    where: { id: householdId },
    data: input,
  });

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ household });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, householdId } = await params;
  const context = await requireWorkspace(weddingId, "GUESTS", "EDIT");

  // Guests are kept and simply lose their household link (onDelete: SetNull).
  const { count } = await prisma.household.deleteMany({
    where: { id: householdId, weddingId },
  });
  if (count === 0) throw notFound("That household does not exist.");

  broadcastChange(weddingId, "guests", context.user.id);
  return ok({ ok: true });
});
