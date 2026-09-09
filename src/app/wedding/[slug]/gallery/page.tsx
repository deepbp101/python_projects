import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PhotoUploadForm } from "@/components/guest-contribute";
import { formatLongDate } from "@/lib/dates";
import { loadPublicGallery } from "@/lib/services/celebrations";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: "Photos",
  robots: { index: false },
};

/**
 * The shared gallery, as guests see it.
 *
 * Reached from the QR code on the tables, so it opens straight onto the upload
 * form: someone scanning mid-reception wants to post the photo they just took, not
 * browse. Everything already shared sits below.
 */
export default async function PublicGalleryPage({ params }: Params) {
  const { slug } = await params;
  const loaded = await loadPublicGallery(slug);
  if (!loaded) notFound();

  const { site, photos } = loaded;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface px-5 py-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-clay">
          {site.wedding.title}
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink">Photos</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {formatLongDate(site.wedding.weddingDate)}
        </p>
        {site.galleryNote && (
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
            {site.galleryNote}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-6 p-5 sm:p-8">
        <PhotoUploadForm slug={site.slug} />

        {photos.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">
            Nothing here yet — be the first.
          </p>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
            {photos.map((photo) => (
              <figure
                key={photo.id}
                className="break-inside-avoid overflow-hidden rounded-xl border border-line bg-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served from our own access-checked route */}
                <img
                  src={`/api/files/${photo.upload.id}`}
                  alt={photo.caption ?? ""}
                  width={photo.upload.width ?? undefined}
                  height={photo.upload.height ?? undefined}
                  loading="lazy"
                  className="w-full object-cover"
                />
                {(photo.caption || photo.uploaderName) && (
                  <figcaption className="space-y-0.5 p-2.5">
                    {photo.caption && (
                      <p className="text-xs text-ink">{photo.caption}</p>
                    )}
                    {photo.uploaderName && (
                      <p className="text-[11px] text-ink-faint">
                        {photo.uploaderName}
                      </p>
                    )}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        <p className="text-center text-sm">
          <Link
            href={`/wedding/${site.slug}`}
            className="text-clay-dark underline underline-offset-4"
          >
            Back to the wedding page
          </Link>
        </p>
      </main>
    </div>
  );
}
