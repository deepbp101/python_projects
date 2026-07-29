import { ok, requireWorkspace, route } from "@/lib/api";
import { prisma } from "@/lib/db";
import { summarizeBudget, upcomingPayments } from "@/lib/domain/budget";

type Params = { params: Promise<{ weddingId: string }> };

/** The whole budget view: categories, line items, rollups and reminders. */
export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspace(weddingId, "BUDGET", "VIEW");

  const [categories, items] = await Promise.all([
    prisma.budgetCategory.findMany({
      where: { weddingId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.budgetItem.findMany({
      where: { weddingId },
      include: { payments: { orderBy: { dueDate: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return ok({
    summary: summarizeBudget(context.wedding.totalBudget, categories, items),
    items,
    reminders: upcomingPayments(items),
    currency: context.wedding.currency,
  });
});
