"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUploader } from "@/components/image-uploader";
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
import type { MoodCategory } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  MOOD_CATEGORIES,
  MOOD_CATEGORY_LABELS,
} from "@/lib/domain/moodboard";

export type MoodItem = {
  id: string;
  category: MoodCategory;
  title: string | null;
  note: string | null;
  sourceUrl: string | null;
  uploadId: string | null;
  width: number | null;
  height: number | null;
};

/**
 * The vision board.
 *
 * Laid out as a CSS masonry-ish column flow so portrait and landscape
 * inspiration sit together without cropping — the whole point is seeing the
 * images as they are.
 */
export function MoodBoardView({
  weddingId,
  canEdit,
  title,
  isShared,
  items,
}: {
  weddingId: string;
  canEdit: boolean;
  title: string;
  isShared: boolean;
  items: MoodItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<MoodCategory | "ALL">("ALL");
  const [adding, setAdding] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const visible =
    filter === "ALL"
      ? items
      : items.filter((item) => item.category === filter);

  const usedCategories = MOOD_CATEGORIES.filter((category) =>
    items.some((item) => item.category === category),
  );

  async function toggleShare() {
    setError(null);
    try {
      const result = await apiFetch<{ shared: boolean; shareUrl: string | null }>(
        `/api/weddings/${weddingId}/moodboard/share`,
        { method: "POST", body: { shared: !isShared } },
      );
      setShareUrl(result.shareUrl);
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function remove(itemId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/moodboard/items/${itemId}`, {
        method: "DELETE",
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
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            {items.length} image{items.length === 1 ? "" : "s"}
            {isShared && <Badge tone="sage">Shared</Badge>}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={toggleShare}>
              {isShared ? "Stop sharing" : "Share"}
            </Button>
            <Button onClick={() => setAdding((open) => !open)}>
              {adding ? "Close" : "Add image"}
            </Button>
          </div>
        )}
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      {shareUrl && (
        <div className="rounded-xl bg-surface-sunk p-3">
          <p className="text-xs text-ink-soft">
            Anyone with this link can see the board. Stop sharing to revoke it.
          </p>
          <code className="mt-1 block break-all text-xs text-ink">{shareUrl}</code>
        </div>
      )}

      {adding && canEdit && (
        <AddMoodItemForm
          weddingId={weddingId}
          onDone={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(["ALL", ...usedCategories] as (MoodCategory | "ALL")[]).map(
            (option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={clsx(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  filter === option
                    ? "bg-ink text-canvas"
                    : "bg-surface text-ink-soft hover:bg-surface-sunk",
                )}
              >
                {option === "ALL" ? "All" : MOOD_CATEGORY_LABELS[option]}
              </button>
            ),
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? "Nothing pinned yet" : "Nothing in here"}
          description={
            items.length === 0
              ? "Add the images you keep coming back to — dresses, florals, table settings — and tag them so the whole vision is in one place."
              : "Try another category."
          }
        />
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {visible.map((item) => (
            <MoodCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              onDelete={() => remove(item.id)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export function MoodCard({
  item,
  canEdit = false,
  shareToken,
  onDelete,
}: {
  item: MoodItem;
  canEdit?: boolean;
  shareToken?: string;
  onDelete?: () => void;
}) {
  const src = item.uploadId
    ? `/api/files/${item.uploadId}${shareToken ? `?share=${encodeURIComponent(shareToken)}` : ""}`
    : null;

  return (
    <figure className="break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- served from our own access-checked route
        <img
          src={src}
          alt={item.title ?? ""}
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          loading="lazy"
          className="w-full object-cover"
        />
      )}
      <figcaption className="space-y-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-ink-faint">
            {MOOD_CATEGORY_LABELS[item.category]}
          </span>
          {canEdit && onDelete && (
            <button
              onClick={onDelete}
              aria-label={`Remove ${item.title ?? "image"}`}
              className="rounded px-1 text-xs text-ink-faint transition-colors hover:text-danger"
            >
              ×
            </button>
          )}
        </div>
        {item.title && (
          <p className="text-sm font-medium text-ink">{item.title}</p>
        )}
        {item.note && <p className="text-xs text-ink-soft">{item.note}</p>}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-clay-dark underline underline-offset-2"
          >
            Source
          </a>
        )}
      </figcaption>
    </figure>
  );
}

function AddMoodItemForm({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: () => void;
}) {
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [category, setCategory] = useState<MoodCategory>("DECOR");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!uploadId) {
      setError("Choose an image first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/moodboard`, {
        method: "POST",
        body: {
          uploadId,
          category,
          title: title || null,
          note: note || null,
          sourceUrl: sourceUrl || null,
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
        <div>
          <span className="mb-1 block text-sm font-medium text-ink-soft">
            Image
          </span>
          <ImageUploader
            weddingId={weddingId}
            section="MOODBOARD"
            currentUploadId={uploadId}
            onUploaded={setUploadId}
            onCleared={() => setUploadId(null)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as MoodCategory)
              }
            >
              {MOOD_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {MOOD_CATEGORY_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title (optional)">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Blush garden roses"
            />
          </Field>
        </div>

        <Field label="Note (optional)">
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Love the loose, unstructured shape."
          />
        </Field>

        <Field label="Where you found it (optional)">
          <Input
            type="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://…"
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy || !uploadId}>
          {busy ? "Adding…" : "Add to board"}
        </Button>
      </form>
    </Card>
  );
}
