"use client";

import { useRef, useState } from "react";
import { Button, ErrorMessage } from "@/components/ui";
import { errorMessage } from "@/lib/client/api";

type UploadResponse = {
  upload: { id: string; url: string; width: number | null; height: number | null };
};

/**
 * Image picker used by the mood board and the site cover.
 *
 * Uploads go straight to the API as multipart — `apiFetch` is JSON-only, and
 * setting Content-Type by hand on FormData would strip the multipart boundary.
 */
export function ImageUploader({
  weddingId,
  section,
  disabled = false,
  currentUploadId,
  label = "Choose image",
  onUploaded,
  onCleared,
}: {
  weddingId: string;
  section: "MOODBOARD" | "WEBSITE" | "VENDORS";
  disabled?: boolean;
  currentUploadId?: string | null;
  label?: string;
  onUploaded: (uploadId: string) => void;
  onCleared?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append("section", section);

    try {
      const response = await fetch(`/api/weddings/${weddingId}/uploads`, {
        method: "POST",
        body: form,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "That upload failed.");
      }
      onUploaded((payload as UploadResponse).upload.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      {currentUploadId && (
        // eslint-disable-next-line @next/next/no-img-element -- served from our own access-checked route
        <img
          src={`/api/files/${currentUploadId}`}
          alt="Selected"
          className="h-32 w-full rounded-xl object-cover"
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        disabled={disabled || busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
        className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-clay-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-clay-dark hover:file:bg-clay-soft/70 disabled:opacity-50"
        aria-label={label}
      />

      {busy && <p className="text-xs text-ink-faint">Uploading…</p>}

      {currentUploadId && onCleared && !disabled && (
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1 text-xs"
          onClick={onCleared}
        >
          Remove image
        </Button>
      )}

      <ErrorMessage>{error}</ErrorMessage>
    </div>
  );
}
