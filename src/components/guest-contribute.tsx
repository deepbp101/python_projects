"use client";

import { useRef, useState } from "react";
import { Button, ErrorMessage, Input, Select, Textarea } from "@/components/ui";
import { apiUpload, errorMessage } from "@/lib/client/api";
import {
  GUEST_BOOK_KIND_LABELS,
  MAX_GUEST_MESSAGE,
  MAX_GUEST_NAME,
} from "@/lib/domain/contributions";
import type { GuestBookKind } from "@/generated/prisma/enums";

/**
 * The forms guests fill in — one for photos, one for the guest book.
 *
 * Both are deliberately plain: a guest at a reception is on a phone, one-handed,
 * possibly holding a drink. No account, no validation gauntlet, and the file
 * pickers carry `capture` hints so a phone offers the camera or recorder directly
 * rather than making someone find a file.
 */

function Thanks({ pending, onAgain }: { pending: boolean; onAgain: () => void }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 text-center">
      <p className="font-display text-lg text-ink">Thank you</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
        {pending
          ? "The couple will see it shortly — they're approving things themselves."
          : "It's on the page now."}
      </p>
      <Button variant="secondary" className="mt-4" onClick={onAgain}>
        Add another
      </Button>
    </div>
  );
}

export function PhotoUploadForm({ slug }: { slug: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploaderName, setUploaderName] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<{ pending: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <Thanks
        pending={done.pending}
        onAgain={() => {
          setDone(null);
          setFile(null);
          setCaption("");
          if (fileInput.current) fileInput.current.value = "";
        }}
      />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Choose a photo first.");
      return;
    }

    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    if (uploaderName.trim()) form.append("uploaderName", uploaderName.trim());
    if (caption.trim()) form.append("caption", caption.trim());

    try {
      const result = await apiUpload<{ pending: boolean }>(
        `/api/public/${encodeURIComponent(slug)}/gallery`,
        form,
      );
      setDone({ pending: result.pending });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-line bg-surface p-5"
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        aria-label="Choose a photo"
        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-clay file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
      />

      <Input
        value={uploaderName}
        maxLength={MAX_GUEST_NAME}
        onChange={(event) => setUploaderName(event.target.value)}
        placeholder="Your name (optional)"
        aria-label="Your name"
      />
      <Input
        value={caption}
        maxLength={200}
        onChange={(event) => setCaption(event.target.value)}
        placeholder="Caption (optional)"
        aria-label="Caption"
      />

      <ErrorMessage>{error}</ErrorMessage>

      <Button type="submit" disabled={busy || !file} className="w-full">
        {busy ? "Sending…" : "Share this photo"}
      </Button>
    </form>
  );
}

export function GuestBookForm({ slug }: { slug: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<GuestBookKind>("TEXT");
  const [guestName, setGuestName] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState<{ pending: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) {
    return (
      <Thanks
        pending={done.pending}
        onAgain={() => {
          setDone(null);
          setMessage("");
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
        }}
      />
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!guestName.trim()) {
      setError("Let them know who this is from.");
      return;
    }
    if (kind === "TEXT" && !message.trim()) {
      setError("Write a message, or switch to a recording.");
      return;
    }
    if (kind !== "TEXT" && !file) {
      setError("Choose or record a file first.");
      return;
    }

    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("kind", kind);
    form.append("guestName", guestName.trim());
    if (message.trim()) form.append("message", message.trim());
    if (file) form.append("file", file);

    try {
      const result = await apiUpload<{ pending: boolean }>(
        `/api/public/${encodeURIComponent(slug)}/guestbook`,
        form,
      );
      setDone({ pending: result.pending });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-line bg-surface p-5"
    >
      <Select
        value={kind}
        onChange={(event) => {
          setKind(event.target.value as GuestBookKind);
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
        }}
        aria-label="How would you like to leave a message?"
      >
        {(Object.keys(GUEST_BOOK_KIND_LABELS) as GuestBookKind[]).map((option) => (
          <option key={option} value={option}>
            {GUEST_BOOK_KIND_LABELS[option]}
          </option>
        ))}
      </Select>

      <Input
        required
        value={guestName}
        maxLength={MAX_GUEST_NAME}
        onChange={(event) => setGuestName(event.target.value)}
        placeholder="Your name"
        aria-label="Your name"
      />

      {kind === "TEXT" ? (
        <Textarea
          value={message}
          rows={4}
          maxLength={MAX_GUEST_MESSAGE}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Say something to them."
          aria-label="Your message"
        />
      ) : (
        <>
          <input
            ref={fileInput}
            type="file"
            accept={kind === "VOICE" ? "audio/*" : "video/*"}
            capture={kind === "VIDEO" ? "user" : undefined}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            aria-label={kind === "VOICE" ? "Record or choose audio" : "Record or choose video"}
            className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-clay file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />
          <Textarea
            value={message}
            rows={2}
            maxLength={MAX_GUEST_MESSAGE}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Add a written note too (optional)"
            aria-label="Written note"
          />
          <p className="text-xs text-ink-faint">
            Keep it under a minute or so — long recordings may be too large to send.
          </p>
        </>
      )}

      <ErrorMessage>{error}</ErrorMessage>

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sending…" : "Leave your message"}
      </Button>
    </form>
  );
}
