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
import { updateBudgetItemSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; itemId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, itemId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");
  const input = await parseBody(request, updateBudgetItemSchema);

  const existing = await prisma.budgetItem.findFirst({
    where: { id: itemId, weddingId },
  });
  if (!existing) throw notFound("That line item does not exist.");

  if (input.categoryId) {
    const category = await prisma.budgetCategory.findFirst({
      where: { id: input.categoryId, weddingId },
      select: { id: true },
    });
    if (!category) throw badRequest("Pick a category from this wedding.");
  }

  const item = await prisma.budgetItem.update({
    where: { id: itemId },
    data: input,
    include: { payments: { orderBy: { dueDate: "asc" } } },
  });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ item });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, itemId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");

  const { count } = await prisma.budgetItem.deleteMany({
    where: { id: itemId, weddingId },
  });
  if (count === 0) throw notFound("That line item does not exist.");

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ ok: true });
});
