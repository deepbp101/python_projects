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
import { updateBudgetCategorySchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; categoryId: string }> };

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, categoryId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");
  const input = await parseBody(request, updateBudgetCategorySchema);

  const existing = await prisma.budgetCategory.findFirst({
    where: { id: categoryId, weddingId },
  });
  if (!existing) throw notFound("That budget category does not exist.");

  const category = await prisma.budgetCategory.update({
    where: { id: categoryId },
    data: input,
  });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ category });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, categoryId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");

  const existing = await prisma.budgetCategory.findFirst({
    where: { id: categoryId, weddingId },
    include: { _count: { select: { items: true } } },
  });
  if (!existing) throw notFound("That budget category does not exist.");

  // Deleting would cascade to the line items and silently lose spend history.
  if (existing._count.items > 0) {
    throw badRequest(
      "Move or delete this category's line items before deleting it.",
    );
  }

  await prisma.budgetCategory.delete({ where: { id: categoryId } });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ ok: true });
});
