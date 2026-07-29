"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  ProgressBar,
  Select,
  Stat,
} from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";
import type { BudgetSummary, SpendStatus } from "@/lib/domain/budget";
import { formatMoney, parseMoney } from "@/lib/money";

type BoardPayment = {
  id: string;
  label: string;
  amount: number;
  dueDate: string | null;
  paidAt: string | null;
};

type BoardItem = {
  id: string;
  categoryId: string;
  name: string;
  vendorName: string | null;
  plannedAmount: number;
  actualAmount: number;
  payments: BoardPayment[];
};

type BoardReminder = {
  paymentId: string;
  itemName: string;
  label: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  isOverdue: boolean;
};

const TONE: Record<SpendStatus, "clay" | "alert" | "danger"> = {
  OK: "clay",
  WARNING: "alert",
  OVER: "danger",
};

export function BudgetBoard({
  weddingId,
  currency,
  canEdit,
  summary,
  items,
  reminders,
}: {
  weddingId: string;
  currency: string;
  canEdit: boolean;
  summary: BudgetSummary;
  items: BoardItem[];
  reminders: BoardReminder[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState(false);

  const refresh = () => startTransition(() => router.refresh());

  async function markPaid(paymentId: string, paid: boolean) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/budget/payments/${paymentId}`, {
        method: "PATCH",
        body: { paidAt: paid ? new Date().toISOString() : null },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function removeItem(itemId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/budget/items/${itemId}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Budget</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {formatMoney(summary.totalPaid, currency)} spent of{" "}
            {formatMoney(summary.totalBudget, currency)}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="secondary"
            onClick={() => setAddingCategory((open) => !open)}
          >
            {addingCategory ? "Close" : "Add category"}
          </Button>
        )}
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Budget"
            value={formatMoney(summary.totalBudget, currency)}
          />
          <Stat label="Paid" value={formatMoney(summary.totalPaid, currency)} />
          <Stat
            label="Still owed"
            value={formatMoney(summary.totalOutstanding, currency)}
          />
          <Stat
            label="Left"
            value={formatMoney(summary.remainingAmount, currency)}
          />
        </div>
        <div className="mt-4">
          <ProgressBar
            value={summary.percentUsed}
            tone={TONE[summary.status]}
            label="Budget used"
          />
        </div>
        {summary.isOverAllocated && (
          <p className="mt-3 rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
            Your category budgets add up to{" "}
            {formatMoney(summary.totalCategoryPlanned, currency)} — more than
            your overall budget.
          </p>
        )}
      </Card>

      {reminders.length > 0 && (
        <Card>
          <CardTitle>Payments coming up</CardTitle>
          <ul className="space-y-2">
            {reminders.map((reminder) => (
              <li
                key={reminder.paymentId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {reminder.itemName}
                    <span className="text-ink-faint"> · {reminder.label}</span>
                  </p>
                  <p className="text-xs text-ink-faint">
                    Due {formatDate(reminder.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular text-sm text-ink">
                    {formatMoney(reminder.amount, currency)}
                  </span>
                  <Badge tone={reminder.isOverdue ? "danger" : "alert"}>
                    {reminder.isOverdue
                      ? `${Math.abs(reminder.daysUntilDue)}d overdue`
                      : `in ${reminder.daysUntilDue}d`}
                  </Badge>
                  {canEdit && (
                    <Button
                      variant="secondary"
                      className="px-3 py-1 text-xs"
                      onClick={() => markPaid(reminder.paymentId, true)}
                    >
                      Mark paid
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {addingCategory && canEdit && (
        <AddCategoryForm
          weddingId={weddingId}
          onDone={() => {
            setAddingCategory(false);
            refresh();
          }}
        />
      )}

      {summary.categories.length === 0 ? (
        <EmptyState
          title="No budget categories yet"
          description="Add categories like Venue, Catering and Photography, then track line items and payments under each."
        />
      ) : (
        <div className="space-y-4">
          {summary.categories.map((category) => {
            const categoryItems = items.filter(
              (item) => item.categoryId === category.id,
            );
            return (
              <Card key={category.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: category.color }}
                    />
                    <h2 className="font-display text-lg text-ink">
                      {category.name}
                    </h2>
                    {category.status !== "OK" && (
                      <Badge tone={category.status === "OVER" ? "danger" : "alert"}>
                        {category.status === "OVER"
                          ? "Over budget"
                          : "Nearing limit"}
                      </Badge>
                    )}
                  </div>
                  <p className="tabular text-sm text-ink-soft">
                    {formatMoney(category.paidAmount, currency)} /{" "}
                    {formatMoney(category.plannedAmount, currency)}
                  </p>
                </div>

                <div className="mt-3">
                  <ProgressBar
                    value={category.percentUsed}
                    tone={TONE[category.status]}
                    label={`${category.name} budget used`}
                  />
                </div>

                {categoryItems.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {categoryItems.map((item) => (
                      <BudgetItemRow
                        key={item.id}
                        weddingId={weddingId}
                        item={item}
                        currency={currency}
                        canEdit={canEdit}
                        onChanged={refresh}
                        onMarkPaid={markPaid}
                        onDelete={removeItem}
                      />
                    ))}
                  </ul>
                )}

                {canEdit && (
                  <div className="mt-4">
                    {addingItemFor === category.id ? (
                      <AddItemForm
                        weddingId={weddingId}
                        categoryId={category.id}
                        onDone={() => {
                          setAddingItemFor(null);
                          refresh();
                        }}
                        onCancel={() => setAddingItemFor(null)}
                      />
                    ) : (
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => setAddingItemFor(category.id)}
                      >
                        + Add line item
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

function BudgetItemRow({
  weddingId,
  item,
  currency,
  canEdit,
  onChanged,
  onMarkPaid,
  onDelete,
}: {
  weddingId: string;
  item: BoardItem;
  currency: string;
  canEdit: boolean;
  onChanged: () => void;
  onMarkPaid: (paymentId: string, paid: boolean) => void;
  onDelete: (itemId: string) => void;
}) {
  const [addingPayment, setAddingPayment] = useState(false);

  const paid = item.payments.length
    ? item.payments.reduce((sum, p) => sum + (p.paidAt ? p.amount : 0), 0)
    : item.actualAmount;

  return (
    <li className="rounded-xl bg-surface-sunk p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{item.name}</p>
          {item.vendorName && (
            <p className="text-xs text-ink-faint">{item.vendorName}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="tabular text-sm text-ink-soft">
            {formatMoney(paid, currency)} paid ·{" "}
            {formatMoney(item.plannedAmount, currency)} planned
          </p>
          {canEdit && (
            <button
              onClick={() => onDelete(item.id)}
              aria-label={`Delete ${item.name}`}
              className="rounded-lg px-2 py-0.5 text-xs text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {item.payments.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.payments.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-ink-soft">
                {payment.label}
                {payment.dueDate && ` · due ${formatDate(payment.dueDate)}`}
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular text-ink">
                  {formatMoney(payment.amount, currency)}
                </span>
                {payment.paidAt ? (
                  <Badge tone="sage">Paid</Badge>
                ) : canEdit ? (
                  <button
                    onClick={() => onMarkPaid(payment.id, true)}
                    className="rounded-full bg-surface px-2 py-0.5 text-ink-soft transition-colors hover:text-ink"
                  >
                    Mark paid
                  </button>
                ) : (
                  <Badge>Unpaid</Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-2">
          {addingPayment ? (
            <AddPaymentForm
              weddingId={weddingId}
              itemId={item.id}
              onDone={() => {
                setAddingPayment(false);
                onChanged();
              }}
              onCancel={() => setAddingPayment(false)}
            />
          ) : (
            <button
              onClick={() => setAddingPayment(true)}
              className="text-xs text-clay-dark underline underline-offset-2"
            >
              + Add payment
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function useMoneyField(initial = "") {
  const [raw, setRaw] = useState(initial);
  return {
    raw,
    setRaw,
    cents: () => parseMoney(raw),
  };
}

function AddCategoryForm({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const planned = useMoneyField("");
  const [threshold, setThreshold] = useState("90");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const plannedAmount = planned.cents();
    if (plannedAmount === null) {
      setError("That amount doesn't look like a number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/budget/categories`, {
        method: "POST",
        body: {
          name,
          plannedAmount,
          alertThresholdPct: Number(threshold) || 90,
        },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Category">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Flowers & Decor"
              required
            />
          </Field>
          <Field label="Budget">
            <Input
              value={planned.raw}
              onChange={(event) => planned.setRaw(event.target.value)}
              inputMode="decimal"
              placeholder="3,000"
            />
          </Field>
          <Field label="Warn at" hint="Percent of the category budget.">
            <Input
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add category"}
        </Button>
      </form>
    </Card>
  );
}

function AddItemForm({
  weddingId,
  categoryId,
  onDone,
  onCancel,
}: {
  weddingId: string;
  categoryId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [vendorName, setVendorName] = useState("");
  const planned = useMoneyField("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const plannedAmount = planned.cents();
    if (plannedAmount === null) {
      setError("That amount doesn't look like a number.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/budget/items`, {
        method: "POST",
        body: {
          categoryId,
          name,
          vendorName: vendorName || null,
          plannedAmount,
        },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-surface-sunk p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Line item">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ceremony flowers"
            required
          />
        </Field>
        <Field label="Vendor (optional)">
          <Input
            value={vendorName}
            onChange={(event) => setVendorName(event.target.value)}
          />
        </Field>
        <Field label="Planned">
          <Input
            value={planned.raw}
            onChange={(event) => planned.setRaw(event.target.value)}
            inputMode="decimal"
            placeholder="1,200"
          />
        </Field>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="px-3 py-1 text-xs">
          {busy ? "Adding…" : "Add"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-1 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddPaymentForm({
  weddingId,
  itemId,
  onDone,
  onCancel,
}: {
  weddingId: string;
  itemId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("Deposit");
  const amount = useMoneyField("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const cents = amount.cents();
    if (cents === null || cents <= 0) {
      setError("Enter the payment amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(
        `/api/weddings/${weddingId}/budget/items/${itemId}/payments`,
        {
          method: "POST",
          body: { label, amount: cents, dueDate: dueDate || null },
        },
      );
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-3 rounded-xl bg-surface p-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="What for">
          <Select value={label} onChange={(event) => setLabel(event.target.value)}>
            <option>Deposit</option>
            <option>Instalment</option>
            <option>Final payment</option>
            <option>Payment</option>
          </Select>
        </Field>
        <Field label="Amount">
          <Input
            value={amount.raw}
            onChange={(event) => amount.setRaw(event.target.value)}
            inputMode="decimal"
            required
          />
        </Field>
        <Field label="Due">
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy} className="px-3 py-1 text-xs">
          {busy ? "Adding…" : "Add payment"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="px-3 py-1 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
