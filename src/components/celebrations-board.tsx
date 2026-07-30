"use client";

import clsx from "clsx";
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
  Textarea,
} from "@/components/ui";
import type { GuestBookKind } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";
import {
  GUEST_BOOK_KIND_LABELS,
  isPubliclyVisible,
  summarizeContributions,
} from "@/lib/domain/contributions";

export type GalleryPhotoView = {
  id: string;
  uploadId: string;
  caption: string | null;
  uploaderName: string | null;
  approvedAt: string | null;
  hiddenAt: string | null;
  createdAt: string;
  width: number | null;
  height: number | null;
};

export type GuestBookEntryView = {
  id: string;
  kind: GuestBookKind;
  guestName: string;
  message: string | null;
  uploadId: string | null;
  approvedAt: string | null;
  hiddenAt: string | null;
  createdAt: string;
};

export type CelebrationSettings = {
  published: boolean;
  slug: string;
  galleryEnabled: boolean;
  galleryNote: string | null;
  guestBookEnabled: boolean;
  guestBookNote: string | null;
  moderateGuestPosts: boolean;
};

/**
 * The couple's side of everything guests contribute.
 *
 * The moderation queue is the point of this screen, so pending submissions sort
 * first and nothing is ever deleted by a single tap — hiding is reversible,
 * deleting asks. The state shown for each item comes from the same
 * `isPubliclyVisible` rule the public pages use, so the badge cannot disagree with
 * reality.
 */
export function CelebrationsBoard({
  weddingId,
  canEdit,
  settings,
  photos,
  entries,
  galleryUrl,
  guestBookUrl,
  galleryQr,
}: {
  weddingId: string;
  canEdit: boolean;
  settings: CelebrationSettings;
  photos: GalleryPhotoView[];
  entries: GuestBookEntryView[];
  galleryUrl: string | null;
  guestBookUrl: string | null;
  /** Server-rendered SVG, so it prints at any size. */
  galleryQr: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [tab, setTab] = useState<"photos" | "guestbook" | "links">("photos");
  const [error, setError] = useState<string | null>(null);

  const photoCounts = summarizeContributions(photos, settings.moderateGuestPosts);
  const entryCounts = summarizeContributions(entries, settings.moderateGuestPosts);

  async function moderate(
    kind: "gallery" | "guestbook",
    id: string,
    body: { approved?: boolean; hidden?: boolean },
  ) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/${kind}/${id}`, {
        method: "PATCH",
        body,
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function remove(kind: "gallery" | "guestbook", id: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/${kind}/${id}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  // Pending first — this screen exists to clear a queue.
  const pendingFirst = <T extends { approvedAt: string | null; hiddenAt: string | null }>(
    items: T[],
  ) =>
    [...items].sort((a, b) => {
      const rank = (item: T) =>
        item.hiddenAt ? 2 : isPubliclyVisible(item, settings.moderateGuestPosts) ? 1 : 0;
      return rank(a) - rank(b);
    });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
      <header>
        <h1 className="font-display text-2xl text-ink">Celebrations</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Photos and messages from your guests, and their personal itineraries.
        </p>
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      {!settings.published && (
        <Card className="border-alert/40 bg-alert-soft">
          <p className="text-sm text-ink">
            Your wedding website isn&rsquo;t published yet. Guests reach the gallery
            and guest book through it, so publish the site first.
          </p>
        </Card>
      )}

      {canEdit && <GuestExtrasSettings weddingId={weddingId} settings={settings} />}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["photos", `Photos ${photoCounts.total}`],
            ["guestbook", `Guest book ${entryCounts.total}`],
            ["links", "Guest links"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={clsx(
              "rounded-full px-3 py-1 text-sm transition-colors",
              tab === value
                ? "bg-ink text-canvas"
                : "bg-surface text-ink-soft hover:bg-surface-sunk",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "photos" && (
        <Card>
          <CardTitle
            action={
              <span className="text-xs text-ink-soft">
                {photoCounts.visible} live · {photoCounts.pending} waiting ·{" "}
                {photoCounts.hidden} hidden
              </span>
            }
          >
            Shared photos
          </CardTitle>

          {photos.length === 0 ? (
            <EmptyState
              title="No photos yet"
              description="Once the gallery is open, anything guests post from the QR code lands here for you to approve."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingFirst(photos).map((photo) => (
                <figure
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-line bg-surface"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own access-checked route */}
                  <img
                    src={`/api/files/${photo.uploadId}`}
                    alt={photo.caption ?? ""}
                    loading="lazy"
                    className="h-40 w-full object-cover"
                  />
                  <figcaption className="space-y-2 p-3">
                    <StateBadge
                      item={photo}
                      moderate={settings.moderateGuestPosts}
                    />
                    {photo.caption && (
                      <p className="text-xs text-ink">{photo.caption}</p>
                    )}
                    <p className="text-[11px] text-ink-faint">
                      {photo.uploaderName ?? "Anonymous"} ·{" "}
                      {formatDate(photo.createdAt)}
                    </p>
                    {canEdit && (
                      <ModerationButtons
                        item={photo}
                        moderate={settings.moderateGuestPosts}
                        onApprove={() =>
                          moderate("gallery", photo.id, { approved: true })
                        }
                        onHide={(hidden) =>
                          moderate("gallery", photo.id, { hidden })
                        }
                        onDelete={() => remove("gallery", photo.id)}
                      />
                    )}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "guestbook" && (
        <Card>
          <CardTitle
            action={
              <span className="text-xs text-ink-soft">
                {entryCounts.visible} live · {entryCounts.pending} waiting ·{" "}
                {entryCounts.hidden} hidden
              </span>
            }
          >
            Guest book
          </CardTitle>

          {entries.length === 0 ? (
            <EmptyState
              title="No messages yet"
              description="Guests can leave a written note, a voice message or a short video. They all arrive here first."
            />
          ) : (
            <ul className="space-y-3">
              {pendingFirst(entries).map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-xl border border-line bg-surface p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base text-ink">
                      {entry.guestName}
                    </span>
                    {entry.kind !== "TEXT" && (
                      <Badge tone="clay">
                        {GUEST_BOOK_KIND_LABELS[entry.kind]}
                      </Badge>
                    )}
                    <StateBadge
                      item={entry}
                      moderate={settings.moderateGuestPosts}
                    />
                    <span className="ml-auto text-xs text-ink-faint">
                      {formatDate(entry.createdAt)}
                    </span>
                  </div>

                  {entry.uploadId && (
                    <div className="mt-2">
                      {entry.kind === "VOICE" ? (
                        <audio
                          controls
                          preload="none"
                          src={`/api/files/${entry.uploadId}`}
                          className="w-full"
                        />
                      ) : (
                        <video
                          controls
                          preload="none"
                          src={`/api/files/${entry.uploadId}`}
                          className="max-h-64 w-full rounded-lg bg-black"
                        />
                      )}
                    </div>
                  )}

                  {entry.message && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                      {entry.message}
                    </p>
                  )}

                  {canEdit && (
                    <div className="mt-3">
                      <ModerationButtons
                        item={entry}
                        moderate={settings.moderateGuestPosts}
                        onApprove={() =>
                          moderate("guestbook", entry.id, { approved: true })
                        }
                        onHide={(hidden) =>
                          moderate("guestbook", entry.id, { hidden })
                        }
                        onDelete={() => remove("guestbook", entry.id)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "links" && (
        <div className="space-y-5">
          {galleryQr && galleryUrl && (
            <Card>
              <CardTitle>Print this for the tables</CardTitle>
              <p className="mb-4 text-sm text-ink-soft">
                Scanning it opens the gallery straight on the upload form. It is a
                vector image, so it stays sharp however large you print it.
              </p>
              <div className="flex flex-wrap items-center gap-5">
                <div
                  className="h-40 w-40 shrink-0 rounded-xl border border-line bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
                  /* Server-generated SVG from a URL we built ourselves — no user
                     input reaches it. */
                  dangerouslySetInnerHTML={{ __html: galleryQr }}
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <code className="block break-all rounded-lg bg-surface-sunk p-2 text-xs text-ink">
                    {galleryUrl}
                  </code>
                  {guestBookUrl && (
                    <code className="block break-all rounded-lg bg-surface-sunk p-2 text-xs text-ink">
                      {guestBookUrl}
                    </code>
                  )}
                </div>
              </div>
            </Card>
          )}

          <ItineraryLinks weddingId={weddingId} canEdit={canEdit} />
        </div>
      )}
    </main>
  );
}

function StateBadge({
  item,
  moderate,
}: {
  item: { approvedAt: string | null; hiddenAt: string | null };
  moderate: boolean;
}) {
  if (item.hiddenAt) return <Badge tone="rose">Hidden</Badge>;
  if (isPubliclyVisible(item, moderate)) return <Badge tone="sage">Live</Badge>;
  return <Badge tone="alert">Waiting on you</Badge>;
}

/**
 * Approve, hide, delete. Deleting asks first — it takes the file with it, and a
 * guest's photo of a moment is not recoverable once gone.
 */
function ModerationButtons({
  item,
  moderate,
  onApprove,
  onHide,
  onDelete,
}: {
  item: { approvedAt: string | null; hiddenAt: string | null };
  moderate: boolean;
  onApprove: () => void;
  onHide: (hidden: boolean) => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moderate && !item.approvedAt && !item.hiddenAt && (
        <Button className="px-3 py-1 text-xs" onClick={onApprove}>
          Approve
        </Button>
      )}
      <Button
        variant="secondary"
        className="px-3 py-1 text-xs"
        onClick={() => onHide(!item.hiddenAt)}
      >
        {item.hiddenAt ? "Unhide" : "Hide"}
      </Button>
      {confirming ? (
        <>
          <Button variant="danger" className="px-3 py-1 text-xs" onClick={onDelete}>
            Delete for good
          </Button>
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={() => setConfirming(true)}
        >
          Delete
        </Button>
      )}
    </div>
  );
}

/** Opens the gallery and guest book to guests, and sets the moderation policy. */
function GuestExtrasSettings({
  weddingId,
  settings,
}: {
  weddingId: string;
  settings: CelebrationSettings;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState({
    galleryEnabled: settings.galleryEnabled,
    galleryNote: settings.galleryNote ?? "",
    guestBookEnabled: settings.guestBookEnabled,
    guestBookNote: settings.guestBookNote ?? "",
    moderateGuestPosts: settings.moderateGuestPosts,
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
      await apiFetch(`/api/weddings/${weddingId}/site`, {
        method: "PATCH",
        body: {
          galleryEnabled: draft.galleryEnabled,
          galleryNote: draft.galleryNote || null,
          guestBookEnabled: draft.guestBookEnabled,
          guestBookNote: draft.guestBookNote || null,
          moderateGuestPosts: draft.moderateGuestPosts,
        },
      });
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>What guests can do</CardTitle>
      <form onSubmit={save} className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.galleryEnabled}
            onChange={(event) =>
              setDraft({ ...draft, galleryEnabled: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-line-strong text-clay focus:ring-clay/30"
          />
          <span>
            <span className="font-medium text-ink">Shared photo gallery</span>
            <span className="block text-xs text-ink-soft">
              Guests can post photos from their phones, no account needed.
            </span>
          </span>
        </label>

        {draft.galleryEnabled && (
          <Field label="Note on the gallery page">
            <Input
              value={draft.galleryNote}
              onChange={(event) =>
                setDraft({ ...draft, galleryNote: event.target.value })
              }
              placeholder="Post anything from the day — we'll never see most of these otherwise."
            />
          </Field>
        )}

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.guestBookEnabled}
            onChange={(event) =>
              setDraft({ ...draft, guestBookEnabled: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-line-strong text-clay focus:ring-clay/30"
          />
          <span>
            <span className="font-medium text-ink">Virtual guest book</span>
            <span className="block text-xs text-ink-soft">
              Written notes, voice messages and short videos.
            </span>
          </span>
        </label>

        {draft.guestBookEnabled && (
          <Field label="Note on the guest book page">
            <Input
              value={draft.guestBookNote}
              onChange={(event) =>
                setDraft({ ...draft, guestBookNote: event.target.value })
              }
              placeholder="Tell us something — we'd rather hear your voice than read your handwriting."
            />
          </Field>
        )}

        <label className="flex items-start gap-3 border-t border-line pt-4 text-sm">
          <input
            type="checkbox"
            checked={draft.moderateGuestPosts}
            onChange={(event) =>
              setDraft({ ...draft, moderateGuestPosts: event.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-line-strong text-clay focus:ring-clay/30"
          />
          <span>
            <span className="font-medium text-ink">Approve things before they appear</span>
            <span className="block text-xs text-ink-soft">
              On by default. Turning it off publishes everything currently waiting,
              and anything new goes straight up.
            </span>
          </span>
        </label>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          {saved && <span className="text-xs text-sage">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

/**
 * Issues the personal itinerary links.
 *
 * The full list comes back once and only once — only hashes are stored — so it is
 * rendered as a copyable block rather than a per-guest button. Regenerating is
 * behind a confirmation because it invalidates every link already sent.
 */
function ItineraryLinks({
  weddingId,
  canEdit,
}: {
  weddingId: string;
  canEdit: boolean;
}) {
  const [links, setLinks] = useState<{ name: string; url: string }[] | null>(null);
  const [regenerated, setRegenerated] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function issue(regenerate: boolean) {
    setBusy(true);
    setError(null);
    setConfirming(false);
    try {
      const result = await apiFetch<{
        links: { name: string; url: string }[];
      }>(`/api/weddings/${weddingId}/itineraries`, {
        method: "POST",
        body: { regenerate },
      });
      setLinks(result.links);
      setRegenerated(regenerate);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Personal itineraries</CardTitle>
      <p className="text-sm text-ink-soft">
        Each guest gets a link showing only their own day — their times, their
        table, their meal. Send it with the invitation or a week before.
      </p>

      <ErrorMessage>{error}</ErrorMessage>

      {links && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-ink-soft">
            {links.length === 0
              ? "Everyone already has a link. Regenerate below if you need the list again."
              : `${links.length} link${links.length === 1 ? "" : "s"} — copy these now, they are not shown again.`}
          </p>
          {links.length > 0 && (
            <Textarea
              readOnly
              rows={Math.min(links.length + 1, 10)}
              value={links.map((link) => `${link.name}\t${link.url}`).join("\n")}
              className="font-mono text-xs"
              aria-label="Itinerary links"
            />
          )}
          {regenerated && (
            <p className="text-xs text-alert">
              Every previous link has stopped working.
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button disabled={busy} onClick={() => issue(false)}>
            {busy ? "Working…" : "Create links"}
          </Button>
          {confirming ? (
            <>
              <Button
                variant="danger"
                className="px-3 py-1 text-xs"
                onClick={() => issue(true)}
              >
                Yes, replace every link
              </Button>
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setConfirming(true)}
            >
              Regenerate all
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
