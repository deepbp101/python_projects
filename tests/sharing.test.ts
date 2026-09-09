import { describe, expect, it } from "vitest";
import { redactBudgetItemForVendor } from "@/lib/domain/sharing";

/**
 * The rule these tests exist to defend: a vendor never sees an amount.
 *
 * The scan below walks the serialised payload rather than checking named fields,
 * so a future change that adds `total`, `depositCents` or `price` anywhere in the
 * tree fails here instead of quietly reaching a florist.
 */

const MONEY_KEY =
  /amount|cents|total|price|cost|planned|actual|budget|quote|fee|balance|sum/i;

function moneyKeysIn(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => moneyKeysIn(entry, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, nested]) => [
      ...(MONEY_KEY.test(key) ? [`${path}.${key}`] : []),
      ...moneyKeysIn(nested, `${path}.${key}`),
    ]);
  }
  return [];
}

const item = {
  id: "item-1",
  name: "Flowers",
  payments: [
    {
      id: "pay-2",
      label: "Final payment",
      dueDate: new Date("2027-05-20T00:00:00.000Z"),
      paidAt: null,
    },
    {
      id: "pay-1",
      label: "Deposit",
      dueDate: new Date("2026-11-01T00:00:00.000Z"),
      paidAt: new Date("2026-10-30T00:00:00.000Z"),
    },
  ],
};

describe("redactBudgetItemForVendor", () => {
  it("carries no money-shaped field anywhere in the payload", () => {
    const shared = redactBudgetItemForVendor(item);
    expect(moneyKeysIn(shared)).toEqual([]);
  });

  it("drops amounts even when they are handed straight to it", () => {
    // A caller that forgets the narrow select and passes the whole row must not
    // widen what goes out.
    const shared = redactBudgetItemForVendor({
      ...item,
      // @ts-expect-error -- deliberately passing more than the input type allows
      plannedAmount: 1_300_000,
      actualAmount: 1_339_000,
      payments: item.payments.map((payment) => ({ ...payment, amount: 450_000 })),
    });

    expect(moneyKeysIn(shared)).toEqual([]);
    expect(JSON.stringify(shared)).not.toContain("450000");
    expect(JSON.stringify(shared)).not.toContain("1300000");
  });

  it("keeps the name, the labels and the dates", () => {
    const shared = redactBudgetItemForVendor(item);

    expect(shared.name).toBe("Flowers");
    expect(shared.payments.map((payment) => payment.label)).toEqual([
      "Deposit",
      "Final payment",
    ]);
    expect(shared.payments[0].dueDate).toBe("2026-11-01T00:00:00.000Z");
  });

  it("reports whether a payment is settled, not when", () => {
    const shared = redactBudgetItemForVendor(item);

    expect(shared.payments[0].paid).toBe(true);
    expect(shared.payments[1].paid).toBe(false);
    // The date a couple paid is their business.
    expect(JSON.stringify(shared)).not.toContain("2026-10-30");
  });

  it("orders payments soonest first, with undated ones last", () => {
    const shared = redactBudgetItemForVendor({
      ...item,
      payments: [
        { id: "c", label: "Undated", dueDate: null, paidAt: null },
        ...item.payments,
      ],
    });

    expect(shared.payments.map((payment) => payment.id)).toEqual([
      "pay-1",
      "pay-2",
      "c",
    ]);
  });

  it("handles a line with no payments at all", () => {
    const shared = redactBudgetItemForVendor({
      id: "item-2",
      name: "Cake",
      payments: [],
    });
    expect(shared).toEqual({ id: "item-2", name: "Cake", payments: [] });
  });
});
