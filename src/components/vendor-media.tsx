"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImageUploader } from "@/components/image-uploader";
import { PanoramaViewer } from "@/components/panorama-viewer";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  Field,
  Input,
  Select,
} from "@/components/ui";
import type { VendorMediaKind } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";

export type VendorMediaView = {
  id: string;
  kind: VendorMediaKind;
  uploadId: string | null;
  url: string | null;
  caption: string | null;
};

const KIND_LABELS: Record<VendorMediaKind, string> = {
  PHOTO: "Photo",
  PANORAMA: "360° panorama",
  TOUR_URL: "Virtual tour",
  VIDEO_URL: "Video",
};

/**
 * Media on a vendor's listing, including virtual venue tours.
 *
 * Hosted panoramas render in our own pan viewer; a tour link is embedded in an
 * iframe and sandboxed, because it is someone else's page running next to ours.
 * Adding is limited to whoever created the listing — the directory is shared, so
 * anyone being able to attach media to any vendor would be an obvious problem.
 */
export function VendorMediaPanel({
  weddingId,
  vendorId,
  vendorName,
  canManage,
  media,
}: {
  weddingId: string;
  vendorId: string;
  vendorName: string;
  canManage: boolean;
  media: VendorMediaView[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(mediaId: string) {
    setError(null);
    try {
      await apiFetch(`/api/vendors/${vendorId}/media/${mediaId}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Card>
      <CardTitle
        action={
          canManage && (
            <Button
              variant="secondary"
              className="px-3 py-1 text-xs"
              onClick={() => setAdding((open) => !open)}
            >
              {adding ? "Close" : "Add media"}
            </Button>
          )
        }
      >
        Photos & tours
      </CardTitle>

      <ErrorMessage>{error}</ErrorMessage>

      {adding && canManage && (
        <AddMediaForm
          weddingId={weddingId}
          vendorId={vendorId}
          onAdded={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {media.length === 0 ? (
        <p className="text-sm text-ink-soft">
          Nothing yet.{" "}
          {canManage
            ? `Add a panorama or a tour link so you can walk ${vendorName} again later.`
            : `Whoever added ${vendorName} hasn't posted photos or a tour.`}
        </p>
      ) : (
        <ul className="space-y-5">
          {media.map((item) => (
            <li key={item.id}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={item.kind === "PANORAMA" ? "clay" : "neutral"}>
                  {KIND_LABELS[item.kind]}
                </Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    className="ml-auto px-2 py-1 text-xs"
                    onClick={() => remove(item.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>

              {item.kind === "PANORAMA" && item.uploadId && (
                <PanoramaViewer
                  src={`/api/files/${item.uploadId}`}
                  caption={item.caption}
                />
              )}

              {item.kind === "PHOTO" && item.uploadId && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- served from our own access-checked route */}
                  <img
                    src={`/api/files/${item.uploadId}`}
                    alt={item.caption ?? vendorName}
                    loading="lazy"
                    className="w-full rounded-xl border border-line object-cover"
                  />
                  {item.caption && (
                    <figcaption className="mt-1.5 text-xs text-ink-soft">
                      {item.caption}
                    </figcaption>
                  )}
                </figure>
              )}

              {(item.kind === "TOUR_URL" || item.kind === "VIDEO_URL") &&
                item.url && (
                  <figure>
                    <iframe
                      src={item.url}
                      title={item.caption ?? `${vendorName} tour`}
                      loading="lazy"
                      // Someone else's page: no same-origin access, no top-level
                      // navigation, no downloads.
                      sandbox="allow-scripts allow-presentation"
                      referrerPolicy="no-referrer"
                      allowFullScreen
                      className="aspect-video w-full rounded-xl border border-line bg-surface-sunk"
                    />
                    <figcaption className="mt-1.5 text-xs text-ink-soft">
                      {item.caption ?? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-clay-dark underline underline-offset-2"
                        >
                          Open in a new tab
                        </a>
                      )}
                    </figcaption>
                  </figure>
                )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AddMediaForm({
  weddingId,
  vendorId,
  onAdded,
}: {
  weddingId: string;
  vendorId: string;
  onAdded: () => void;
}) {
  const [kind, setKind] = useState<VendorMediaKind>("PANORAMA");
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsUpload = kind === "PHOTO" || kind === "PANORAMA";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/vendors/${vendorId}/media`, {
        method: "POST",
        body: {
          kind,
          weddingId,
          ...(needsUpload ? { uploadId } : { url }),
          caption: caption || null,
        },
      });
      onAdded();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-5 space-y-4 rounded-xl border border-line bg-surface-sunk p-4"
    >
      <Field label="What are you adding?">
        <Select
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as VendorMediaKind);
            setUploadId(null);
            setUrl("");
          }}
        >
          {(Object.keys(KIND_LABELS) as VendorMediaKind[]).map((option) => (
            <option key={option} value={option}>
              {KIND_LABELS[option]}
            </option>
          ))}
        </Select>
      </Field>

      {needsUpload ? (
        <div>
          <span className="mb-1 block text-sm font-medium text-ink-soft">
            {kind === "PANORAMA" ? "Panorama image" : "Photo"}
          </span>
          <ImageUploader
            weddingId={weddingId}
            section="VENDORS"
            currentUploadId={uploadId}
            onUploaded={setUploadId}
            onCleared={() => setUploadId(null)}
          />
          {kind === "PANORAMA" && (
            <p className="mt-1 text-xs text-ink-faint">
              A wide equirectangular shot — the kind a phone&rsquo;s panorama mode
              produces works well.
            </p>
          )}
        </div>
      ) : (
        <Field
          label="Link"
          hint="An embeddable tour or video URL. It is sandboxed when shown."
        >
          <Input
            required
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
          />
        </Field>
      )}

      <Field label="Caption (optional)">
        <Input
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          placeholder="The barn with the doors open"
        />
      </Field>

      <ErrorMessage>{error}</ErrorMessage>

      <Button
        type="submit"
        disabled={busy || (needsUpload ? !uploadId : url.trim() === "")}
      >
        {busy ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
