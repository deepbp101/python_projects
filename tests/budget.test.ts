import { describe, expect, it } from "vitest";
import {
  defaultCategoriesFor,
  rollUpCategory,
  rollUpItem,
  spendStatus,
  summarizeBudget,
  upcomingPayments,
  type BudgetCategoryLike,
  type BudgetItemLike,
} from "@/lib/domain/budget";

const NOW = new Date("2026-06-01T00:00:00.000Z");

const category = (
  id: string,
  plannedAmount: number,
  alertThresholdPct = 90,
): BudgetCategoryLike => ({
  id,
  name: id,
  plannedAmount,
  alertThresholdPct,
});

const item = (
  id: string,
  categoryId: string,
  plannedAmount: number,
  overrides: Partial<BudgetItemLike> = {},
): BudgetItemLike => ({
  id,
  categoryId,
  name: id,
  plannedAmount,
  actualAmount: 0,
  payments: [],
  ...overrides,
});

describe("rollUpItem", () => {
  it("uses actualAmount when the item has no payment schedule", () => {
    const rollup = rollUpItem(item("a", "cat", 100_000, { actualAmount: 75_000 }));

    expect(rollup.paidAmount).toBe(75_000);
    expect(rollup.scheduledAmount).toBe(75_000);
    expect(rollup.outstandingAmount).toBe(0);
  });

  it("counts only paid payments as spent when a schedule exists", () => {
    const rollup = rollUpItem(
      item("a", "cat", 500_000, {
        payments: [
          { id: "p1", label: "Deposit", amount: 150_000, dueDate: null, paidAt: new Date() },
          { id: "p2", label: "Final", amount: 350_000, dueDate: null, paidAt: null },
        ],
      }),
    );

    expect(rollup.paidAmount).toBe(150_000);
    expect(rollup.scheduledAmount).toBe(500_000);
    expect(rollup.outstandingAmount).toBe(350_000);
  });

  it("ignores actualAmount once payments exist, so nothing double-counts", () => {
    const rollup = rollUpItem(
      item("a", "cat", 500_000, {
        actualAmount: 999_999,
        payments: [
          { id: "p1", label: "Deposit", amount: 100_000, dueDate: null, paidAt: new Date() },
        ],
      }),
    );

    expect(rollup.paidAmount).toBe(100_000);
  });
});

describe("spendStatus", () => {
  it("warns from the threshold and flags over-spend past the cap", () => {
    expect(spendStatus(50_000, 100_000, 90)).toBe("OK");
    expect(spendStatus(89_000, 100_000, 90)).toBe("OK");
    expect(spendStatus(90_000, 100_000, 90)).toBe("WARNING");
    expect(spendStatus(100_000, 100_000, 90)).toBe("WARNING");
    expect(spendStatus(100_001, 100_000, 90)).toBe("OVER");
  });

  it("treats any spend against a zero budget as over", () => {
    expect(spendStatus(0, 0, 90)).toBe("OK");
    expect(spendStatus(1, 0, 90)).toBe("OVER");
  });

  it("respects a custom threshold", () => {
    expect(spendStatus(50_000, 100_000, 50)).toBe("WARNING");
    expect(spendStatus(49_000, 100_000, 50)).toBe("OK");
  });
});

describe("rollUpCategory", () => {
  it("only counts items belonging to the category", () => {
    const rollup = rollUpCategory(category("venue", 1_000_000), [
      item("a", "venue", 400_000, { actualAmount: 300_000 }),
      item("b", "food", 900_000, { actualAmount: 800_000 }),
    ]);

    expect(rollup.itemCount).toBe(1);
    expect(rollup.paidAmount).toBe(300_000);
    expect(rollup.itemsPlannedAmount).toBe(400_000);
    expect(rollup.remainingAmount).toBe(700_000);
    expect(rollup.percentUsed).toBe(30);
  });

  it("reports a negative remaining amount when over the cap", () => {
    const rollup = rollUpCategory(category("flowers", 100_000), [
      item("a", "flowers", 120_000, { actualAmount: 130_000 }),
    ]);

    expect(rollup.status).toBe("OVER");
    expect(rollup.remainingAmount).toBe(-30_000);
    expect(rollup.percentUsed).toBe(130);
  });

  it("handles a category with no items", () => {
    const rollup = rollUpCategory(category("empty", 100_000), []);

    expect(rollup.itemCount).toBe(0);
    expect(rollup.paidAmount).toBe(0);
    expect(rollup.percentUsed).toBe(0);
    expect(rollup.status).toBe("OK");
  });
});

describe("summarizeBudget", () => {
  const categories = [category("venue", 1_000_000), category("food", 500_000)];
  const items = [
    item("a", "venue", 900_000, {
      payments: [
        { id: "p1", label: "Deposit", amount: 300_000, dueDate: null, paidAt: new Date() },
        { id: "p2", label: "Final", amount: 600_000, dueDate: null, paidAt: null },
      ],
    }),
    item("b", "food", 480_000, { actualAmount: 480_000 }),
  ];

  it("totals paid, scheduled and outstanding across categories", () => {
    const summary = summarizeBudget(2_000_000, categories, items);

    expect(summary.totalPaid).toBe(780_000);
    expect(summary.totalScheduled).toBe(1_380_000);
    expect(summary.totalOutstanding).toBe(600_000);
    expect(summary.remainingAmount).toBe(1_220_000);
    expect(summary.percentUsed).toBe(39);
  });

  it("flags over-allocation when category caps exceed the total budget", () => {
    expect(summarizeBudget(2_000_000, categories, items).isOverAllocated).toBe(
      false,
    );
    expect(summarizeBudget(1_000_000, categories, items).isOverAllocated).toBe(
      true,
    );
  });

  it("lists categories needing attention, worst first", () => {
    const summary = summarizeBudget(2_000_000, categories, items);

    expect(summary.alerts.map((alert) => alert.id)).toEqual(["food"]);
    expect(summary.alerts[0].status).toBe("WARNING");
  });

  it("copes with a wedding that has no budget set", () => {
    const summary = summarizeBudget(0, [], []);

    expect(summary.totalPaid).toBe(0);
    expect(summary.percentUsed).toBe(0);
    expect(summary.status).toBe("OK");
    expect(summary.isOverAllocated).toBe(false);
  });
});

describe("upcomingPayments", () => {
  const items = [
    item("venue", "cat", 0, {
      name: "Venue hire",
      vendorName: "The Old Mill",
      payments: [
        { id: "overdue", label: "Deposit", amount: 100_000, dueDate: "2026-05-20", paidAt: null },
        { id: "soon", label: "Instalment", amount: 200_000, dueDate: "2026-06-10", paidAt: null },
        { id: "later", label: "Final", amount: 300_000, dueDate: "2026-12-01", paidAt: null },
        { id: "paid", label: "Booking", amount: 50_000, dueDate: "2026-05-01", paidAt: "2026-05-01" },
        { id: "undated", label: "Extras", amount: 10_000, dueDate: null, paidAt: null },
      ],
    }),
  ];

  it("returns unpaid payments inside the window, overdue first", () => {
    const reminders = upcomingPayments(items, { now: NOW, withinDays: 30 });

    expect(reminders.map((reminder) => reminder.paymentId)).toEqual([
      "overdue",
      "soon",
    ]);
    expect(reminders[0].isOverdue).toBe(true);
    expect(reminders[0].daysUntilDue).toBe(-12);
    expect(reminders[1].isOverdue).toBe(false);
    expect(reminders[1].daysUntilDue).toBe(9);
  });

  it("carries the line item and vendor through for display", () => {
    const [reminder] = upcomingPayments(items, { now: NOW, withinDays: 30 });

    expect(reminder.itemName).toBe("Venue hire");
    expect(reminder.vendorName).toBe("The Old Mill");
    expect(reminder.label).toBe("Deposit");
  });

  it("excludes paid and undated payments entirely", () => {
    const ids = upcomingPayments(items, { now: NOW, withinDays: 3650 }).map(
      (reminder) => reminder.paymentId,
    );

    expect(ids).not.toContain("paid");
    expect(ids).not.toContain("undated");
  });

  it("still surfaces overdue payments when the window is narrow", () => {
    const reminders = upcomingPayments(items, { now: NOW, withinDays: 0 });
    expect(reminders.map((reminder) => reminder.paymentId)).toEqual(["overdue"]);
  });
});

describe("defaultCategoriesFor", () => {
  it("splits the budget without losing more than rounding", () => {
    const total = 4_200_000;
    const categories = defaultCategoriesFor(total);
    const allocated = categories.reduce(
      (sum, entry) => sum + entry.plannedAmount,
      0,
    );

    expect(categories.length).toBeGreaterThan(0);
    expect(Math.abs(allocated - total)).toBeLessThanOrEqual(categories.length);
  });

  it("gives every category a zero budget when no total is set", () => {
    for (const entry of defaultCategoriesFor(0)) {
      expect(entry.plannedAmount).toBe(0);
    }
  });
});
