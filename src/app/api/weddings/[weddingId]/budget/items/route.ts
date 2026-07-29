import { badRequest, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { createBudgetItemSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");
  const input = await parseBody(request, createBudgetItemSchema);

  // Checked explicitly so a category from another wedding cannot be referenced.
  const category = await prisma.budgetCategory.findFirst({
    where: { id: input.categoryId, weddingId },
    select: { id: true },
  });
  if (!category) throw badRequest("Pick a category from this wedding.");

  const item = await prisma.budgetItem.create({
    data: { weddingId, ...input },
    include: { payments: true },
  });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ item }, 201);
});
