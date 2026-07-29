import type { Metadata } from "next";
import { BudgetBoard } from "@/components/budget-board";
import { NoAccess } from "@/components/no-access";
import { prisma } from "@/lib/db";
import { summarizeBudget, upcomingPayments } from "@/lib/domain/budget";
import { canChange, canSee, loadWorkspace } from "@/lib/page";

export const metadata: Metadata = { title: "Budget" };

export default async function BudgetPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { wedding, access } = await loadWorkspace(weddingId);

  if (!canSee(access, "BUDGET")) return <NoAccess section="The budget" />;

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

  const summary = summarizeBudget(wedding.totalBudget, categories, items);
  const reminders = upcomingPayments(items, { withinDays: 45 });

  return (
    <BudgetBoard
      weddingId={weddingId}
      currency={wedding.currency}
      canEdit={canChange(access, "BUDGET")}
      summary={summary}
      reminders={reminders.map((reminder) => ({
        ...reminder,
        dueDate: reminder.dueDate.toISOString(),
      }))}
      items={items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        vendorName: item.vendorName,
        plannedAmount: item.plannedAmount,
        actualAmount: item.actualAmount,
        payments: item.payments.map((payment) => ({
          id: payment.id,
          label: payment.label,
          amount: payment.amount,
          dueDate: payment.dueDate ? payment.dueDate.toISOString() : null,
          paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
        })),
      }))}
    />
  );
}
