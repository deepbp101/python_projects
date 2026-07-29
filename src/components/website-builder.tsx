"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUploader } from "@/components/image-uploader";
import { SITE_TEMPLATES, TEMPLATE_ORDER } from "@/components/site/templates";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import type { SiteTemplate } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";

type SiteState = {
  slug: string;
  template: SiteTemplate;
  headline: string | null;
  intro: string | null;
  storyTitle: string;
  story: string | null;
  travelTitle: string;
  travel: string | null;
  registryNote: string | null;
  rsvpNote: string | null;
  rsvpDeadline: string;
  publishedAt: string | null;
  coverUploadId: string | null;
};

type SiteEvent = {
  id: string;
  name: string;
  startsAt: string;
  venueName: string | null;
  address: string | null;
  description: string | null;
  dressCode: string | null;
};

type RegistryLink = {
  id: string;
  label: string;
  url: string;
  note: string | null;
};

export function WebsiteBuilder({
  weddingId,
  canEdit,
  site,
  events,
  registry,
}: {
  weddingId: string;
  canEdit: boolean;
  site: SiteState;
  events: SiteEvent[];
  registry: RegistryLink[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(site);
  const [addingEvent, setAddingEvent] = useState(false);
  const [addingLink, setAddingLink] = useState(false);

  const isPublished = site.publishedAt !== null;
  const publicUrl = `/wedding/${site.slug}`;

  function set<K extends keyof SiteState>(key: K, value: SiteState[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/site`, {
        method: "PATCH",
        body: {
          slug: draft.slug,
          template: draft.template,
          headline: draft.headline ?? "",
          intro: draft.intro ?? "",
          storyTitle: draft.storyTitle,
          story: draft.story ?? "",
          travelTitle: draft.travelTitle,
          travel: draft.travel ?? "",
          registryNote: draft.registryNote ?? "",
          rsvpNote: draft.rsvpNote ?? "",
          rsvpDeadline: draft.rsvpDeadline || null,
          coverUploadId: draft.coverUploadId,
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

  async function togglePublished() {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/site/publish`, {
        method: "POST",
        body: { published: !isPublished },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function removeEvent(eventId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/site/events/${eventId}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function removeLink(linkId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/site/registry/${linkId}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Wedding website</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-soft">
            {isPublished ? (
              <>
                <Badge tone="sage">Live</Badge>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-clay-dark underline underline-offset-2"
                >
                  {publicUrl}
                </a>
              </>
            ) : (
              <>
                <Badge>Draft</Badge>
                <span>Only you and your collaborators can see this.</span>
              </>
            )}
          </p>
        </div>
        {canEdit && (
          <Button
            variant={isPublished ? "secondary" : "primary"}
            onClick={togglePublished}
          >
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        )}
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      <Card>
        <CardTitle>Template</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMPLATE_ORDER.map((option) => {
            const theme = SITE_TEMPLATES[option];
            const selected = draft.template === option;
            return (
              <button
                key={option}
                type="button"
                disabled={!canEdit}
                aria-pressed={selected}
                onClick={() => set("template", option)}
                className={clsx(
                  "rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-clay bg-clay-soft"
                    : "border-line hover:border-line-strong",
                )}
              >
                <span className="block text-sm font-medium text-ink">
                  {theme.label}
                </span>
                <span className="mt-1 block text-xs text-ink-soft">
                  {theme.description}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>The basics</CardTitle>
        <div className="space-y-4">
          <Field
            label="Web address"
            hint={`Guests will visit /wedding/${draft.slug || "…"}`}
          >
            <Input
              value={draft.slug}
              onChange={(event) => set("slug", event.target.value)}
              disabled={!canEdit}
              placeholder="sam-and-alex"
            />
          </Field>

          <Field label="Headline">
            <Input
              value={draft.headline ?? ""}
              onChange={(event) => set("headline", event.target.value)}
              disabled={!canEdit}
              placeholder="Sam & Alex"
            />
          </Field>

          <Field label="Introduction">
            <Textarea
              value={draft.intro ?? ""}
              onChange={(event) => set("intro", event.target.value)}
              disabled={!canEdit}
              rows={2}
              placeholder="Join us at The Old Mill in the Hudson Valley."
            />
          </Field>

          <div>
            <span className="mb-1 block text-sm font-medium text-ink-soft">
              Cover photo
            </span>
            <ImageUploader
              weddingId={weddingId}
              section="WEBSITE"
              disabled={!canEdit}
              currentUploadId={draft.coverUploadId}
              onUploaded={(uploadId) => set("coverUploadId", uploadId)}
              onCleared={() => set("coverUploadId", null)}
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Your story</CardTitle>
        <div className="space-y-4">
          <Field label="Section title">
            <Input
              value={draft.storyTitle}
              onChange={(event) => set("storyTitle", event.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Story" hint="Leave a blank line between paragraphs.">
            <Textarea
              value={draft.story ?? ""}
              onChange={(event) => set("story", event.target.value)}
              disabled={!canEdit}
              rows={6}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle
          action={
            canEdit ? (
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setAddingEvent((open) => !open)}
              >
                {addingEvent ? "Close" : "+ Add event"}
              </Button>
            ) : undefined
          }
        >
          Events
        </CardTitle>

        {addingEvent && canEdit && (
          <AddEventForm
            weddingId={weddingId}
            onDone={() => {
              setAddingEvent(false);
              refresh();
            }}
          />
        )}

        {events.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No events yet — add the ceremony, reception, or a welcome drink.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-surface-sunk p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{event.name}</p>
                  <p className="text-xs text-ink-faint">
                    {formatDate(event.startsAt)}
                    {event.venueName ? ` · ${event.venueName}` : ""}
                  </p>
                  {event.dressCode && (
                    <p className="mt-1 text-xs text-ink-soft">
                      {event.dressCode}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={() => removeEvent(event.id)}
                    aria-label={`Delete ${event.name}`}
                    className="rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Travel &amp; stays</CardTitle>
        <div className="space-y-4">
          <Field label="Section title">
            <Input
              value={draft.travelTitle}
              onChange={(event) => set("travelTitle", event.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Details" hint="Hotels, room blocks, airports, parking.">
            <Textarea
              value={draft.travel ?? ""}
              onChange={(event) => set("travel", event.target.value)}
              disabled={!canEdit}
              rows={5}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle
          action={
            canEdit ? (
              <Button
                variant="ghost"
                className="px-2 py-1 text-xs"
                onClick={() => setAddingLink((open) => !open)}
              >
                {addingLink ? "Close" : "+ Add registry"}
              </Button>
            ) : undefined
          }
        >
          Registry
        </CardTitle>

        <Field label="A note about gifts">
          <Textarea
            value={draft.registryNote ?? ""}
            onChange={(event) => set("registryNote", event.target.value)}
            disabled={!canEdit}
            rows={2}
            placeholder="Your presence is the gift — but if you'd like to give something…"
          />
        </Field>

        {addingLink && canEdit && (
          <div className="mt-4">
            <AddRegistryForm
              weddingId={weddingId}
              onDone={() => {
                setAddingLink(false);
                refresh();
              }}
            />
          </div>
        )}

        {registry.length > 0 && (
          <ul className="mt-4 space-y-2">
            {registry.map((link) => (
              <li
                key={link.id}
                className="flex items-start justify-between gap-3 rounded-xl bg-surface-sunk p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{link.label}</p>
                  <p className="truncate text-xs text-ink-faint">{link.url}</p>
                </div>
                {canEdit && (
                  <button
                    onClick={() => removeLink(link.id)}
                    aria-label={`Delete ${link.label}`}
                    className="rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    Delete
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>RSVP note</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reply by">
            <Input
              type="date"
              value={draft.rsvpDeadline}
              onChange={(event) => set("rsvpDeadline", event.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="How to reply">
            <Input
              value={draft.rsvpNote ?? ""}
              onChange={(event) => set("rsvpNote", event.target.value)}
              disabled={!canEdit}
              placeholder="Reply to the card in your invitation."
            />
          </Field>
        </div>
      </Card>

      {canEdit && (
        <div className="sticky bottom-20 flex items-center gap-3 lg:bottom-4">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          {saved && <span className="text-sm text-sage">Saved.</span>}
        </div>
      )}
    </main>
  );
}

function AddEventForm({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [address, setAddress] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/site/events`, {
        method: "POST",
        body: {
          name,
          // Times are entered as local wall-clock and rendered in UTC, so what
          // the couple types is what guests read.
          startsAt: new Date(`${startsAt}:00Z`).toISOString(),
          venueName: venueName || null,
          address: address || null,
          dressCode: dressCode || null,
        },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-xl bg-surface-sunk p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Event name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Reception"
            required
          />
        </Field>
        <Field label="Starts">
          <Input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            required
          />
        </Field>
        <Field label="Venue">
          <Input
            value={venueName}
            onChange={(event) => setVenueName(event.target.value)}
          />
        </Field>
        <Field label="Address">
          <Input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </Field>
        <Field label="Dress code">
          <Input
            value={dressCode}
            onChange={(event) => setDressCode(event.target.value)}
            placeholder="Garden formal"
          />
        </Field>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <Button type="submit" disabled={busy} className="px-3 py-1 text-xs">
        {busy ? "Adding…" : "Add event"}
      </Button>
    </form>
  );
}

function AddRegistryForm({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: () => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/site/registry`, {
        method: "POST",
        body: { label, url, note: note || null },
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
        <Field label="Where">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Crate & Barrel"
            required
          />
        </Field>
        <Field label="Link">
          <Input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            required
          />
        </Field>
        <Field label="Note">
          <Input value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <Button type="submit" disabled={busy} className="px-3 py-1 text-xs">
        {busy ? "Adding…" : "Add registry"}
      </Button>
    </form>
  );
}
