import { daysBetween, startOfUtcDay } from "@/lib/dates";
import { percentOf } from "@/lib/money";

/**
 * Budget rollups. Everything here is pure — the route handlers load rows and
 * hand them straight to these functions, so the arithmetic is unit-testable
 * without a database.
 */

export type PaymentLike = {
  id: string;
  label: string;
  amount: number;
  dueDate: Date | string | null;
  paidAt: Date | string | null;
};

export type BudgetItemLike = {
  id: string;
  categoryId: string;
  name: string;
  vendorName?: string | null;
  plannedAmount: number;
  actualAmount: number;
  payments: PaymentLike[];
};

export type BudgetCategoryLike = {
  id: string;
  name: string;
  plannedAmount: number;
  alertThresholdPct: number;
  color?: string;
};

export type SpendStatus = "OK" | "WARNING" | "OVER";

export type ItemRollup = {
  id: string;
  name: string;
  categoryId: string;
  plannedAmount: number;
  /** Money actually out the door. */
  paidAmount: number;
  /** Everything scheduled, paid or not. */
  scheduledAmount: number;
  /** Scheduled but not yet paid. */
  outstandingAmount: number;
};

/**
 * Actual spend for one line item.
 *
 * A line item can be tracked two ways: a single `actualAmount` typed in by
 * hand, or a schedule of payments. When payments exist they are authoritative
 * and `actualAmount` is ignored, otherwise the two would double-count.
 */
export function rollUpItem(item: BudgetItemLike): ItemRollup {
  const hasPayments = item.payments.length > 0;

  const paidAmount = hasPayments
    ? item.payments.reduce((sum, p) => sum + (p.paidAt ? p.amount : 0), 0)
    : item.actualAmount;

  const scheduledAmount = hasPayments
    ? item.payments.reduce((sum, p) => sum + p.amount, 0)
    : item.actualAmount;

  return {
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    plannedAmount: item.plannedAmount,
    paidAmount,
    scheduledAmount,
    outstandingAmount: scheduledAmount - paidAmount,
  };
}

export type CategoryRollup = {
  id: string;
  name: string;
  color?: string;
  /** The category's own budget cap. */
  plannedAmount: number;
  /** Sum of the line items' planned amounts, which can exceed the cap. */
  itemsPlannedAmount: number;
  paidAmount: number;
  scheduledAmount: number;
  outstandingAmount: number;
  remainingAmount: number;
  percentUsed: number;
  status: SpendStatus;
  itemCount: number;
  items: ItemRollup[];
};

export function rollUpCategory(
  category: BudgetCategoryLike,
  items: BudgetItemLike[],
): CategoryRollup {
  const own = items.filter((item) => item.categoryId === category.id);
  const rollups = own.map(rollUpItem);

  const paidAmount = rollups.reduce((sum, r) => sum + r.paidAmount, 0);
  const scheduledAmount = rollups.reduce((sum, r) => sum + r.scheduledAmount, 0);
  const itemsPlannedAmount = rollups.reduce(
    (sum, r) => sum + r.plannedAmount,
    0,
  );

  const percentUsed = percentOf(paidAmount, category.plannedAmount);

  return {
    id: category.id,
    name: category.name,
    color: category.color,
    plannedAmount: category.plannedAmount,
    itemsPlannedAmount,
    paidAmount,
    scheduledAmount,
    outstandingAmount: scheduledAmount - paidAmount,
    remainingAmount: category.plannedAmount - paidAmount,
    percentUsed,
    status: spendStatus(paidAmount, category.plannedAmount, category.alertThresholdPct),
    itemCount: own.length,
    items: rollups,
  };
}

/**
 * `OVER` once spend exceeds the cap, `WARNING` from the category's alert
 * threshold up to that point. Spending against a zero cap is always `OVER` —
 * there is no budget to be within.
 */
export function spendStatus(
  spent: number,
  planned: number,
  alertThresholdPct: number,
): SpendStatus {
  if (planned <= 0) return spent > 0 ? "OVER" : "OK";
  if (spent > planned) return "OVER";
  if (percentOf(spent, planned) >= alertThresholdPct) return "WARNING";
  return "OK";
}

export type BudgetSummary = {
  /** The couple's overall budget for the wedding. */
  totalBudget: number;
  /** Sum of every category cap. */
  totalCategoryPlanned: number;
  totalPaid: number;
  totalScheduled: number;
  totalOutstanding: number;
  remainingAmount: number;
  percentUsed: number;
  status: SpendStatus;
  /** True when the category caps together exceed the overall budget. */
  isOverAllocated: boolean;
  categories: CategoryRollup[];
  /** Categories at or past their alert threshold, worst first. */
  alerts: CategoryRollup[];
};

export function summarizeBudget(
  totalBudget: number,
  categories: BudgetCategoryLike[],
  items: BudgetItemLike[],
): BudgetSummary {
  const rollups = categories.map((category) => rollUpCategory(category, items));

  const totalCategoryPlanned = rollups.reduce(
    (sum, c) => sum + c.plannedAmount,
    0,
  );
  const totalPaid = rollups.reduce((sum, c) => sum + c.paidAmount, 0);
  const totalScheduled = rollups.reduce((sum, c) => sum + c.scheduledAmount, 0);

  return {
    totalBudget,
    totalCategoryPlanned,
    totalPaid,
    totalScheduled,
    totalOutstanding: totalScheduled - totalPaid,
    remainingAmount: totalBudget - totalPaid,
    percentUsed: percentOf(totalPaid, totalBudget),
    status: spendStatus(totalPaid, totalBudget, 90),
    isOverAllocated: totalCategoryPlanned > totalBudget,
    categories: rollups,
    alerts: rollups
      .filter((c) => c.status !== "OK")
      .sort((a, b) => b.percentUsed - a.percentUsed),
  };
}

export type PaymentReminder = {
  paymentId: string;
  itemId: string;
  itemName: string;
  vendorName: string | null;
  label: string;
  amount: number;
  dueDate: Date;
  /** Negative once the due date has passed. */
  daysUntilDue: number;
  isOverdue: boolean;
};

/**
 * Unpaid payments that need attention: anything overdue, plus anything falling
 * due inside `withinDays`. Sorted by urgency, overdue first.
 */
export function upcomingPayments(
  items: BudgetItemLike[],
  { now = new Date(), withinDays = 30 }: { now?: Date; withinDays?: number } = {},
): PaymentReminder[] {
  const today = startOfUtcDay(now);
  const reminders: PaymentReminder[] = [];

  for (const item of items) {
    for (const payment of item.payments) {
      if (payment.paidAt || !payment.dueDate) continue;

      const dueDate = startOfUtcDay(new Date(payment.dueDate));
      const daysUntilDue = daysBetween(today, dueDate);
      if (daysUntilDue > withinDays) continue;

      reminders.push({
        paymentId: payment.id,
        itemId: item.id,
        itemName: item.name,
        vendorName: item.vendorName ?? null,
        label: payment.label,
        amount: payment.amount,
        dueDate,
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
      });
    }
  }

  return reminders.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

/**
 * A sensible starting split of a total budget, used when a workspace is
 * created. Percentages follow the usual industry rule of thumb and sum to 100.
 */
export const DEFAULT_BUDGET_SPLIT: {
  name: string;
  pct: number;
  color: string;
}[] = [
  { name: "Venue & Rentals", pct: 30, color: "#8C6E63" },
  { name: "Catering & Bar", pct: 22, color: "#A98467" },
  { name: "Photography & Video", pct: 12, color: "#6B7F6E" },
  { name: "Attire & Beauty", pct: 8, color: "#B9868B" },
  { name: "Flowers & Decor", pct: 8, color: "#7D8471" },
  { name: "Music & Entertainment", pct: 7, color: "#7A7089" },
  { name: "Stationery & Website", pct: 3, color: "#9A8C98" },
  { name: "Cake & Desserts", pct: 3, color: "#C2A083" },
  { name: "Transportation", pct: 3, color: "#6E7B8B" },
  { name: "Rings & Gifts", pct: 4, color: "#B08968" },
];

export function defaultCategoriesFor(totalBudget: number) {
  return DEFAULT_BUDGET_SPLIT.map((entry, index) => ({
    name: entry.name,
    color: entry.color,
    sortOrder: index,
    plannedAmount: Math.round((totalBudget * entry.pct) / 100),
  }));
}
