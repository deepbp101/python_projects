"use client";

import { useRef, useState } from "react";
import { Button, ErrorMessage, Textarea } from "@/components/ui";
import { apiUpload, errorMessage } from "@/lib/client/api";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  MAX_MESSAGE_LENGTH,
  formatBytes,
} from "@/lib/domain/messaging";

/**
 * Writes a message, with files.
 *
 * The text and its attachments go in one request, so a quote can never arrive as
 * a file with no message or a message pointing at a file that failed to upload.
 * Used by both sides of a thread — the vendor's version adds a name field, since
 * they have no account to take it from.
 */
export function MessageComposer({
  endpoint,
  askForName = false,
  defaultName = "",
  placeholder = "Write a message…",
  onSent,
}: {
  endpoint: string;
  askForName?: boolean;
  defaultName?: string;
  placeholder?: string;
  onSent: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState(defaultName);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (body.trim() === "") return;

    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("body", body.trim());
    if (askForName && authorName.trim()) {
      form.append("authorName", authorName.trim());
    }
    for (const file of files) form.append("files", file);

    try {
      await apiUpload(endpoint, form);
      setBody("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      onSent();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} className="space-y-3">
      {askForName && (
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-clay focus:outline-none focus:ring-2 focus:ring-clay/20 sm:max-w-xs"
        />
      )}

      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={MAX_MESSAGE_LENGTH}
        placeholder={placeholder}
        aria-label="Message"
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="rounded-full bg-surface-sunk px-3 py-1 text-xs text-ink-soft"
            >
              {file.name} · {formatBytes(file.size)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) =>
            setFiles(
              Array.from(event.target.files ?? []).slice(
                0,
                MAX_ATTACHMENTS_PER_MESSAGE,
              ),
            )
          }
          aria-label="Attach files"
          className="min-w-0 flex-1 text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-clay-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-clay-dark hover:file:bg-clay-soft/70"
        />
        <Button type="submit" disabled={busy || body.trim() === ""}>
          {busy ? "Sending…" : "Send"}
        </Button>
      </div>

      <p className="text-xs text-ink-faint">
        PDFs and images, up to {MAX_ATTACHMENTS_PER_MESSAGE} at a time.
      </p>

      <ErrorMessage>{error}</ErrorMessage>
    </form>
  );
}
