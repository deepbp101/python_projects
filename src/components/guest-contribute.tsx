"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import { Button, ErrorMessage, Input, Textarea } from "@/components/ui";
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


/**
 * The file picker guests actually tap.
 *
 * A bare `<input type="file">` renders as the browser's "Choose File / No file
 * chosen" — a small grey control, and on this page it is the *only* thing a
 * guest came to do, reached by scanning a code at a reception while holding a
 * drink. So: a full-width target, and once something is picked, a preview, so
 * they can see they grabbed the right photo before sending it to someone's
 * wedding.
 */
function FilePicker({
  inputRef,
  accept,
  capture,
  file,
  preview,
  onPick,
  idle,
  hint,
  icon = "camera",
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  capture?: "environment" | "user";
  file: File | null;
  preview: string | null;
  onPick: (file: File | null) => void;
  idle: string;
  hint: string;
  /** Matches what is being captured — a camera over "record a voice note" lies. */
  icon?: "camera" | "mic" | "video";
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-surface-sunk px-4 py-6 text-center transition-colors hover:border-clay hover:bg-clay-soft/40">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        capture={capture}
        onChange={(event) => onPick(event.target.files?.[0] ?? null)}
        className="sr-only"
      />

      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local object URL, never an optimisable asset
        <img
          src={preview}
          alt=""
          className="max-h-40 w-auto rounded-xl object-contain"
        />
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-clay"
        >
          {icon === "mic" ? (
            <>
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
              <path d="M12 18v3M9 21h6" />
            </>
          ) : icon === "video" ? (
            <>
              <rect x="2.5" y="6.5" width="13" height="11" rx="2" />
              <path d="m15.5 11 6-3.5v9l-6-3.5z" />
            </>
          ) : (
            <>
              <path d="M3.5 8.5h3l1.5-2.5h8l1.5 2.5h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
              <circle cx="12" cy="13.5" r="3.5" />
            </>
          )}
        </svg>
      )}

      <span className="text-sm font-medium text-ink">
        {file ? file.name : idle}
      </span>
      <span className="text-xs text-ink-faint">{file ? "Tap to change" : hint}</span>
    </label>
  );
}

export function PhotoUploadForm({ slug }: { slug: string }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploaderName, setUploaderName] = useState("");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [done, setDone] = useState<{ pending: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Object URLs are revoked as they are replaced rather than in an effect, so
  // there is no window where a stale one is still allocated.
  function pick(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  if (done) {
    return (
      <Thanks
        pending={done.pending}
        onAgain={() => {
          setDone(null);
          pick(null);
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
      <FilePicker
        inputRef={fileInput}
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        file={file}
        preview={preview}
        onPick={pick}
        idle="Add a photo"
        hint="Your camera or camera roll"
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
      {/*
        Three visible choices rather than a dropdown. Couples put notes like
        "we'd rather hear your voice than read your handwriting" on this page,
        and a closed <select> reading "Written" answers that with the one option
        they were trying to talk you out of. All three, one tap each.
      */}
      <fieldset>
        <legend className="sr-only">How would you like to leave a message?</legend>
        <div className="flex gap-1 rounded-xl bg-surface-sunk p-1">
          {(Object.keys(GUEST_BOOK_KIND_LABELS) as GuestBookKind[]).map(
            (option) => (
              <button
                key={option}
                type="button"
                aria-pressed={kind === option}
                onClick={() => {
                  setKind(option);
                  setFile(null);
                  if (fileInput.current) fileInput.current.value = "";
                }}
                className={clsx(
                  "min-h-[40px] flex-1 rounded-lg px-2 text-sm transition-colors",
                  kind === option
                    ? "bg-surface font-medium text-ink shadow-sm"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {GUEST_BOOK_KIND_LABELS[option]}
              </button>
            ),
          )}
        </div>
      </fieldset>

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
          <FilePicker
            inputRef={fileInput}
            accept={kind === "VOICE" ? "audio/*" : "video/*"}
            capture={kind === "VIDEO" ? "user" : undefined}
            file={file}
            // No preview for a recording: an audio file has no thumbnail, and a
            // video poster costs a decode for something the guest just filmed.
            preview={null}
            onPick={setFile}
            icon={kind === "VOICE" ? "mic" : "video"}
            idle={kind === "VOICE" ? "Record a message" : "Record a video"}
            hint="Your phone will offer its recorder"
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
