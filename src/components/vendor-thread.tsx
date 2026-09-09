"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MessageComposer } from "@/components/message-composer";
import { MessageList, type ThreadMessage } from "@/components/message-list";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  Select,
} from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";
import type { VendorFacingBudgetItem } from "@/lib/domain/sharing";

export type ActiveShare = {
  id: string;
  kind: "MOOD_BOARD" | "BUDGET_ITEM";
  label: string;
  /** The shared budget line's id, so the picker can hide what is already shared. */
  budgetItemId: string | null;
  /** Present for a budget share: exactly what the vendor sees. */
  payments: VendorFacingBudgetItem["payments"] | null;
};

/**
 * The conversation with one vendor, and what has been shared into it.
 *
 * Opening the thread clears its unread badge through a request rather than a
 * write during render, since the realtime layer re-renders this page often.
 */
export function VendorThreadPanel({
  weddingId,
  weddingVendorId,
  vendorName,
  canEdit,
  messages,
  shares,
  shareableItems,
  moodBoardTitle,
  unread,
}: {
  weddingId: string;
  weddingVendorId: string;
  vendorName: string;
  canEdit: boolean;
  messages: ThreadMessage[];
  shares: ActiveShare[];
  /** Null when the signed-in collaborator has no budget access. */
  shareableItems: VendorFacingBudgetItem[] | null;
  /** Null when they have no mood board access. */
  moodBoardTitle: string | null;
  unread: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const base = `/api/weddings/${weddingId}/vendors/${weddingVendorId}`;
  const [error, setError] = useState<string | null>(null);

  // Once per visit: marking read triggers a refresh, and refreshing must not
  // trigger another mark-read.
  const marked = useRef(false);
  useEffect(() => {
    if (unread === 0 || marked.current) return;
    marked.current = true;
    void apiFetch(`${base}/thread/read`, { method: "POST" })
      .then(() => router.refresh())
      .catch(() => {
        // A failed read receipt is not worth interrupting anyone over; the badge
        // clears on the next visit.
      });
  }, [base, unread, router]);

  async function share(body: { moodBoard?: boolean; budgetItemId?: string }) {
    setError(null);
    try {
      await apiFetch(`${base}/thread/shares`, { method: "POST", body });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function revoke(shareId: string) {
    setError(null);
    try {
      await apiFetch(`${base}/thread/shares`, {
        method: "DELETE",
        body: { shareId },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const moodBoardShared = shares.some((s) => s.kind === "MOOD_BOARD");

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Shared with {vendorName}</CardTitle>

        <ErrorMessage>{error}</ErrorMessage>

        {shares.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Nothing shared yet. They can only see the messages in this thread.
          </p>
        ) : (
          <ul className="space-y-3">
            {shares.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-line bg-surface-sunk p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.kind === "MOOD_BOARD" ? "rose" : "clay"}>
                    {item.kind === "MOOD_BOARD" ? "Mood board" : "Payment dates"}
                  </Badge>
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    {item.label}
                  </span>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() => revoke(item.id)}
                    >
                      Stop sharing
                    </Button>
                  )}
                </div>
                {item.payments && <PaymentPreview payments={item.payments} />}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-4 space-y-3 border-t border-line pt-4">
            {moodBoardTitle && !moodBoardShared && (
              <Button
                variant="secondary"
                onClick={() => share({ moodBoard: true })}
              >
                Share our mood board
              </Button>
            )}

            {shareableItems && shareableItems.length > 0 && (
              <BudgetSharePicker
                items={shareableItems.filter(
                  (item) =>
                    !shares.some(
                      (existing) => existing.budgetItemId === item.id,
                    ),
                )}
                onShare={(budgetItemId) => share({ budgetItemId })}
              />
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Messages</CardTitle>
        <MessageList messages={messages} viewer="COUPLE" />

        {canEdit && (
          <div className="mt-5 border-t border-line pt-4">
            <MessageComposer
              endpoint={`${base}/thread/messages`}
              placeholder={`Message ${vendorName}…`}
              onSent={refresh}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Picks a budget line to share, and shows the payload first.
 *
 * The preview is not decoration. Server-side redaction removes every amount
 * column, but it cannot remove a number the couple typed into a payment label
 * themselves ("Deposit — $2,000 on signing"). Reading the exact text before
 * sending is the only thing that catches that.
 */
function BudgetSharePicker({
  items,
  onShare,
}: {
  items: VendorFacingBudgetItem[];
  onShare: (budgetItemId: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const preview = items.find((item) => item.id === selected);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium text-ink-soft">
            Share payment dates for
          </span>
          <Select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Choose a budget line…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </label>
        <Button
          variant="secondary"
          disabled={!preview}
          onClick={() => {
            if (preview) onShare(preview.id);
            setSelected("");
          }}
        >
          Share
        </Button>
      </div>

      {preview && (
        <div className="rounded-xl border border-line bg-surface-sunk p-3">
          <p className="text-xs font-medium text-ink-soft">
            Exactly what they will see — no amounts, ever:
          </p>
          <PaymentPreview payments={preview.payments} />
          {preview.payments.length === 0 && (
            <p className="mt-1 text-xs text-ink-faint">
              This line has no scheduled payments yet, so there would be nothing
              to show.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PaymentPreview({
  payments,
}: {
  payments: VendorFacingBudgetItem["payments"];
}) {
  if (payments.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <span className="min-w-0 flex-1 truncate text-ink">
            {payment.label}
          </span>
          <span className="tabular text-ink-soft">
            {payment.dueDate ? formatDate(payment.dueDate) : "No date set"}
          </span>
          <Badge tone={payment.paid ? "sage" : "neutral"}>
            {payment.paid ? "Paid" : "Due"}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
