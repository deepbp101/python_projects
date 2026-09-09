import { notFound, ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { broadcastChange } from "@/lib/realtime/emit";
import { updatePaymentSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string; paymentId: string }> };

/** Ensures the payment belongs to this wedding before it can be touched. */
async function findScopedPayment(paymentId: string, weddingId: string) {
  return prisma.payment.findFirst({
    where: { id: paymentId, budgetItem: { weddingId } },
    select: { id: true },
  });
}

export const PATCH = route(async (request: Request, { params }: Params) => {
  const { weddingId, paymentId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");
  const input = await parseBody(request, updatePaymentSchema);

  if (!(await findScopedPayment(paymentId, weddingId))) {
    throw notFound("That payment does not exist.");
  }

  const { dueDate, paidAt, ...rest } = input;
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      ...rest,
      ...(dueDate !== undefined
        ? { dueDate: dueDate ? new Date(dueDate) : null }
        : {}),
      ...(paidAt !== undefined
        ? { paidAt: paidAt ? new Date(paidAt) : null }
        : {}),
    },
  });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ payment });
});

export const DELETE = route(async (_request: Request, { params }: Params) => {
  const { weddingId, paymentId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "EDIT");

  if (!(await findScopedPayment(paymentId, weddingId))) {
    throw notFound("That payment does not exist.");
  }

  await prisma.payment.delete({ where: { id: paymentId } });

  broadcastChange(weddingId, "budget", context.user.id);
  return ok({ ok: true });
});
