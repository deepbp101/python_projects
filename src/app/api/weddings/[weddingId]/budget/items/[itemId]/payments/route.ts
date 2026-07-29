import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { createPaymentSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; itemId: string }> };

export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId, itemId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");
  const input = await parseBody(request, createPaymentSchema);

  const item = await prisma.budgetItem.findFirst({
    where: { id: itemId, weddingId },
    select: { id: true },
  });
  if (!item) throw notFound("That line item does not exist.");

  const payment = await prisma.payment.create({
    data: {
      budgetItemId: itemId,
      label: input.label,
      amount: input.amount,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
      method: input.method ?? null,
      notes: input.notes ?? null,
    },
  });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ payment }, 201);
});
