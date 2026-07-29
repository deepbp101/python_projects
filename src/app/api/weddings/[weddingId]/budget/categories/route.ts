import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { createBudgetCategorySchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");
  const input = await parseBody(request, createBudgetCategorySchema);

  const count = await prisma.budgetCategory.count({ where: { weddingId } });
  const category = await prisma.budgetCategory.create({
    data: { weddingId, ...input, sortOrder: count },
  });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ category }, 201);
});
