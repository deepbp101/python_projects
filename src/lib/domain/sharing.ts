/**
 * What a vendor is allowed to see when the couple shares something into a thread.
 *
 * The rule this file exists to enforce: **a vendor never sees an amount.** Telling
 * your florist what you have allocated for flowers before they quote is a bad
 * trade for the couple, and it cannot be undone once seen. So a shared budget
 * line carries the schedule — what is due, when, and whether it is settled — and
 * nothing about money.
 *
 * That is enforced in two independent places, because one is not enough:
 *   1. the loader selects a narrow set of columns and never fetches the amounts;
 *   2. the mappers below build a fresh object field by field, so an amount that
 *      somehow arrives is dropped rather than passed through.
 *
 * `tests/sharing.test.ts` walks the serialised payload and fails on any key that
 * looks like money, which is what stops a later "just add the total" change.
 */

export type VendorFacingPayment = {
  id: string;
  label: string;
  /** ISO date, or null for a payment with no agreed date yet. */
  dueDate: string | null;
  paid: boolean;
};

export type VendorFacingBudgetItem = {
  id: string;
  name: string;
  payments: VendorFacingPayment[];
};

type PaymentInput = {
  id: string;
  label: string;
  dueDate: Date | string | null;
  paidAt: Date | string | null;
};

type BudgetItemInput = {
  id: string;
  name: string;
  payments: PaymentInput[];
};

const isoOrNull = (value: Date | string | null): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
};

/**
 * `paidAt` becomes a boolean rather than a date. When a couple settled an
 * invoice is their business; that a payment is settled is the vendor's.
 */
function redactPayment(payment: PaymentInput): VendorFacingPayment {
  return {
    id: payment.id,
    label: payment.label,
    dueDate: isoOrNull(payment.dueDate),
    paid: payment.paidAt !== null && payment.paidAt !== undefined,
  };
}

/** Payments in the order a vendor cares about: soonest first, undated last. */
function bySoonest(a: VendorFacingPayment, b: VendorFacingPayment): number {
  if (a.dueDate === null && b.dueDate === null) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate.localeCompare(b.dueDate);
}

export function redactBudgetItemForVendor(
  item: BudgetItemInput,
): VendorFacingBudgetItem {
  return {
    id: item.id,
    name: item.name,
    payments: item.payments.map(redactPayment).sort(bySoonest),
  };
}

/**
 * The couple's own preview of a share.
 *
 * Identical to what the vendor receives, by construction — the point is that the
 * couple can read the exact payload before they send it. A label they typed
 * themselves ("Deposit — $2,000 on signing") is the one way a number can still
 * reach a vendor, and no amount of server-side redaction can catch that. Showing
 * them the payload is what does.
 */
export const previewBudgetItemShare = redactBudgetItemForVendor;
