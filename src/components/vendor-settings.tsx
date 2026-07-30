"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StarPicker } from "@/components/stars";
import {
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { VendorStatus } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  VENDOR_STATUS_LABELS,
  VENDOR_STATUSES,
} from "@/lib/domain/vendors";

export type VendorReviewDraft = {
  rating: number;
  title: string;
  body: string;
} | null;

/** Everything about a vendor that is the couple's business, not the vendor's. */
export function VendorSettings({
  weddingId,
  weddingVendorId,
  vendorName,
  canEdit,
  status,
  contactName,
  contactEmail,
  notes,
  budgetItemId,
  budgetItems,
  review,
  hasLink,
}: {
  weddingId: string;
  weddingVendorId: string;
  vendorName: string;
  canEdit: boolean;
  status: VendorStatus;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  budgetItemId: string | null;
  /** Null when the collaborator has no budget access. */
  budgetItems: { id: string; name: string }[] | null;
  review: VendorReviewDraft;
  hasLink: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const base = `/api/weddings/${weddingId}/vendors/${weddingVendorId}`;

  const [draft, setDraft] = useState({
    status,
    contactName: contactName ?? "",
    contactEmail: contactEmail ?? "",
    notes: notes ?? "",
    budgetItemId: budgetItemId ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(base, {
        method: "PATCH",
        body: {
          status: draft.status,
          contactName: draft.contactName || null,
          contactEmail: draft.contactEmail || null,
          notes: draft.notes || null,
          ...(budgetItems ? { budgetItemId: draft.budgetItemId || null } : {}),
        },
      });
      setSaved(true);
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Where things stand</CardTitle>
        <form onSubmit={save} className="space-y-4">
          <Field label="Status">
            <Select
              value={draft.status}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  status: event.target.value as VendorStatus,
                })
              }
            >
              {VENDOR_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {VENDOR_STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Contact">
            <Input
              value={draft.contactName}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft({ ...draft, contactName: event.target.value })
              }
              placeholder="Who you deal with"
            />
          </Field>

          <Field label="Their email">
            <Input
              type="email"
              value={draft.contactEmail}
              disabled={!canEdit}
              onChange={(event) =>
                setDraft({ ...draft, contactEmail: event.target.value })
              }
            />
          </Field>

          {budgetItems && (
            <Field
              label="Paid from"
              hint="Links this vendor to a budget line so the payment schedule is in one place."
            >
              <Select
                value={draft.budgetItemId}
                disabled={!canEdit}
                onChange={(event) =>
                  setDraft({ ...draft, budgetItemId: event.target.value })
                }
              >
                <option value="">Not linked</option>
                {budgetItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field
            label="Private notes"
            hint="Never shared with the vendor, whatever else you send them."
          >
            <Textarea
              value={draft.notes}
              disabled={!canEdit}
              rows={4}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
              placeholder="Quoted for 120, needs a decision by the 14th."
            />
          </Field>

          <ErrorMessage>{error}</ErrorMessage>

          {canEdit && (
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
              {saved && <span className="text-xs text-sage">Saved</span>}
            </div>
          )}
        </form>
      </Card>

      {canEdit && (
        <VendorLinkPanel
          base={base}
          vendorName={vendorName}
          hasLink={hasLink}
          onChanged={refresh}
        />
      )}

      {canEdit && (
        <ReviewEditor base={base} review={review} onSaved={refresh} />
      )}
    </div>
  );
}

/**
 * Grants or withdraws the vendor's link.
 *
 * The URL is shown once, right after it is minted — only its hash is stored, so
 * it cannot be looked up again later. Withdrawing and re-granting produces a
 * different link, which is what makes revoking mean something.
 */
function VendorLinkPanel({
  base,
  vendorName,
  hasLink,
  onChanged,
}: {
  base: string;
  vendorName: string;
  hasLink: boolean;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ threadUrl: string | null }>(
        `${base}/thread/access`,
        { method: "POST", body: { granted: !hasLink } },
      );
      setUrl(result.threadUrl);
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Vendor access</CardTitle>

      <p className="text-sm text-ink-soft">
        {hasLink
          ? `${vendorName} can open this thread with the link you sent them. They see the messages and anything you have shared — never your notes, status or budget.`
          : `Send ${vendorName} a link and they can read and reply here without making an account.`}
      </p>

      <ErrorMessage>{error}</ErrorMessage>

      {url && (
        <div className="mt-3 rounded-xl bg-surface-sunk p-3">
          <p className="text-xs text-ink-soft">
            Copy this now — it is not shown again.
          </p>
          <code className="mt-1 block break-all text-xs text-ink">{url}</code>
        </div>
      )}

      <Button
        variant={hasLink ? "danger" : "secondary"}
        className="mt-4"
        disabled={busy}
        onClick={toggle}
      >
        {busy ? "Working…" : hasLink ? "Withdraw access" : "Create a link"}
      </Button>
    </Card>
  );
}

/** This wedding's review, which shows on the vendor's public directory profile. */
function ReviewEditor({
  base,
  review,
  onSaved,
}: {
  base: string;
  review: VendorReviewDraft;
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [title, setTitle] = useState(review?.title ?? "");
  const [body, setBody] = useState(review?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError("Pick a star rating first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${base}/review`, {
        method: "PUT",
        body: { rating, title: title || null, body: body || null },
      });
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${base}/review`, { method: "DELETE" });
      setRating(0);
      setTitle("");
      setBody("");
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Your review</CardTitle>
      <p className="mb-3 text-sm text-ink-soft">
        Shown on their directory listing to other couples, under your first name.
        Which wedding it came from is never published.
      </p>

      <form onSubmit={submit} className="space-y-4">
        <StarPicker value={rating} onChange={setRating} />

        <Field label="Headline">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Worth every penny"
          />
        </Field>

        <Field label="Review">
          <Textarea
            value={body}
            rows={3}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What they were like to work with."
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : review ? "Update review" : "Post review"}
          </Button>
          {review && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={remove}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
