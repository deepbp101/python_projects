"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StarRating } from "@/components/stars";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { VendorCategory, VendorStatus } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { messageTimestamp } from "@/lib/domain/messaging";
import {
  priceTierLabel,
  summarizeShortlist,
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABELS,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_TONES,
  VENDOR_STATUSES,
} from "@/lib/domain/vendors";

export type ShortlistVendor = {
  id: string;
  vendorId: string;
  name: string;
  category: VendorCategory;
  city: string | null;
  priceTier: number | null;
  status: VendorStatus;
  contactName: string | null;
  budgetItemName: string | null;
  rating: { average: number | null; count: number };
  /** Whether the vendor currently holds a working link to their thread. */
  hasLink: boolean;
  lastMessageAt: string | null;
  unread: number;
};

type DirectoryResult = {
  id: string;
  name: string;
  category: VendorCategory;
  city: string | null;
  priceTier: number | null;
  description: string | null;
  website: string | null;
  rating: { average: number | null; count: number };
  onShortlist: boolean;
};

/**
 * The couple's vendor list, plus a way into the shared directory.
 *
 * The shortlist comes first and the directory is opt-in: by the time most people
 * open this page they already know who they are talking to, and a search box as
 * the first thing on screen would get in the way of that.
 */
export function VendorBoard({
  weddingId,
  canEdit,
  vendors,
}: {
  weddingId: string;
  canEdit: boolean;
  vendors: ShortlistVendor[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "search" | "new">("none");
  const [statusFilter, setStatusFilter] = useState<VendorStatus | "ALL">("ALL");

  const counts = summarizeShortlist(vendors);
  const visible =
    statusFilter === "ALL"
      ? vendors
      : vendors.filter((vendor) => vendor.status === statusFilter);

  async function changeStatus(id: string, status: VendorStatus) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/vendors/${id}`, {
        method: "PATCH",
        body: { status },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Vendors</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {vendors.length === 0
              ? "Nobody on the list yet"
              : `${counts.BOOKED} booked of ${vendors.length}`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setPanel((open) => (open === "search" ? "none" : "search"))
              }
            >
              Search directory
            </Button>
            <Button
              onClick={() =>
                setPanel((open) => (open === "new" ? "none" : "new"))
              }
            >
              {panel === "new" ? "Close" : "Add vendor"}
            </Button>
          </div>
        )}
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      {panel === "search" && canEdit && (
        <DirectorySearch
          weddingId={weddingId}
          onAdded={() => {
            setPanel("none");
            refresh();
          }}
        />
      )}

      {panel === "new" && canEdit && (
        <NewVendorForm
          weddingId={weddingId}
          onAdded={() => {
            setPanel("none");
            refresh();
          }}
        />
      )}

      {vendors.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["ALL", ...VENDOR_STATUSES] as (VendorStatus | "ALL")[])
            .filter((option) => option === "ALL" || counts[option] > 0)
            .map((option) => (
              <button
                key={option}
                onClick={() => setStatusFilter(option)}
                className={clsx(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  statusFilter === option
                    ? "bg-ink text-canvas"
                    : "bg-surface text-ink-soft hover:bg-surface-sunk",
                )}
              >
                {option === "ALL"
                  ? `All ${vendors.length}`
                  : `${VENDOR_STATUS_LABELS[option]} ${counts[option]}`}
              </button>
            ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={
            vendors.length === 0 ? "No vendors yet" : "Nothing with that status"
          }
          description={
            vendors.length === 0
              ? "Add the people you are talking to — venue, photographer, florist — and keep every quote and message in one thread instead of scattered across email."
              : "Try another status."
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((vendor) => (
            <li key={vendor.id}>
              <VendorRow
                weddingId={weddingId}
                vendor={vendor}
                canEdit={canEdit}
                onStatusChange={(status) => changeStatus(vendor.id, status)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function VendorRow({
  weddingId,
  vendor,
  canEdit,
  onStatusChange,
}: {
  weddingId: string;
  vendor: ShortlistVendor;
  canEdit: boolean;
  onStatusChange: (status: VendorStatus) => void;
}) {
  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/w/${weddingId}/vendors/${vendor.id}`}
            className="font-display text-base text-ink underline-offset-4 hover:underline"
          >
            {vendor.name}
          </Link>
          <Badge tone={VENDOR_STATUS_TONES[vendor.status]}>
            {VENDOR_STATUS_LABELS[vendor.status]}
          </Badge>
          {vendor.unread > 0 && (
            <Badge tone="clay">
              {vendor.unread} new {vendor.unread === 1 ? "reply" : "replies"}
            </Badge>
          )}
        </div>

        <p className="mt-1 text-xs text-ink-soft">
          {VENDOR_CATEGORY_LABELS[vendor.category]}
          {vendor.city && ` · ${vendor.city}`}
          {vendor.priceTier && ` · ${priceTierLabel(vendor.priceTier)}`}
          {vendor.budgetItemName && ` · ${vendor.budgetItemName}`}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <StarRating
            value={vendor.rating.average}
            count={vendor.rating.count}
          />
          {vendor.hasLink && (
            <span className="text-xs text-sage">Link active</span>
          )}
          {vendor.lastMessageAt && (
            <span className="text-xs text-ink-faint" suppressHydrationWarning>
              Last message {messageTimestamp(vendor.lastMessageAt)}
            </span>
          )}
        </div>
      </div>

      {canEdit && (
        <Select
          aria-label={`Status for ${vendor.name}`}
          value={vendor.status}
          onChange={(event) =>
            onStatusChange(event.target.value as VendorStatus)
          }
          className="w-auto"
        >
          {VENDOR_STATUSES.map((option) => (
            <option key={option} value={option}>
              {VENDOR_STATUS_LABELS[option]}
            </option>
          ))}
        </Select>
      )}
    </Card>
  );
}

/** Search across the shared directory, so a well-reviewed vendor is findable. */
function DirectorySearch({
  weddingId,
  onAdded,
}: {
  weddingId: string;
  onAdded: () => void;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<VendorCategory | "">("");
  const [minRating, setMinRating] = useState("0");
  const [results, setResults] = useState<DirectoryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (q) query.set("q", q);
      if (category) query.set("category", category);
      if (minRating !== "0") query.set("minRating", minRating);

      const result = await apiFetch<{ vendors: DirectoryResult[] }>(
        `/api/weddings/${weddingId}/vendors/directory?${query}`,
      );
      setResults(result.vendors);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function add(vendorId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/vendors`, {
        method: "POST",
        body: { vendorId },
      });
      onAdded();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Card>
      <form onSubmit={search} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr_auto]">
          <Field label="Search">
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Name, city or description"
            />
          </Field>
          <Field label="Category">
            <Select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as VendorCategory | "")
              }
            >
              <option value="">Any</option>
              {VENDOR_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {VENDOR_CATEGORY_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rated at least">
            <Select
              value={minRating}
              onChange={(event) => setMinRating(event.target.value)}
            >
              <option value="0">Any</option>
              <option value="3">3 stars</option>
              <option value="4">4 stars</option>
              <option value="4.5">4.5 stars</option>
            </Select>
          </Field>
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </form>

      {results !== null && (
        <div className="mt-5 border-t border-line pt-4">
          {results.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nothing matched. Add them yourself with “Add vendor”.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {results.map((result) => (
                <li
                  key={result.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{result.name}</p>
                    <p className="text-xs text-ink-soft">
                      {VENDOR_CATEGORY_LABELS[result.category]}
                      {result.city && ` · ${result.city}`}
                      {result.priceTier &&
                        ` · ${priceTierLabel(result.priceTier)}`}
                    </p>
                    <StarRating
                      className="mt-1"
                      value={result.rating.average}
                      count={result.rating.count}
                    />
                  </div>
                  {result.onShortlist ? (
                    <Badge tone="sage">On your list</Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => add(result.id)}>
                      Add
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/** Adds a vendor that is not in the directory yet, creating the listing too. */
function NewVendorForm({
  weddingId,
  onAdded,
}: {
  weddingId: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<VendorCategory>("VENUE");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/vendors`, {
        method: "POST",
        body: {
          vendor: {
            name,
            category,
            city: city || null,
            website: website || null,
          },
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          notes: notes || null,
        },
      });
      onAdded();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <Input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Wildflower Studio"
            />
          </Field>
          <Field label="Category">
            <Select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as VendorCategory)
              }
            >
              {VENDOR_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {VENDOR_CATEGORY_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="City">
            <Input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Portland"
            />
          </Field>
          <Field
            label="Website"
            hint="Listings are shared with other couples, so keep this factual."
          >
            <Input
              type="url"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Your contact there">
            <Input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              placeholder="Nadia"
            />
          </Field>
          <Field label="Their email">
            <Input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="hello@example.com"
            />
          </Field>
        </div>

        <Field label="Private notes" hint="Only your workspace sees this.">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            placeholder="Quoted for 120 guests, waiting on the full breakdown."
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy || name.trim() === ""}>
          {busy ? "Adding…" : "Add to my list"}
        </Button>
      </form>
    </Card>
  );
}
