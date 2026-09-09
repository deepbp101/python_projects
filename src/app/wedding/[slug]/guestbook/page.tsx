import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestBookForm } from "@/components/guest-contribute";
import { Badge } from "@/components/ui";
import { formatDate, formatLongDate } from "@/lib/dates";
import { GUEST_BOOK_KIND_LABELS } from "@/lib/domain/contributions";
import { loadPublicGuestBook } from "@/lib/services/celebrations";

type Params = { params: Promise<{ slug: string }> };

export const metadata: Metadata = {
  title: "Guest book",
  robots: { index: false },
};

/**
 * The guest book. Written notes, voice notes and short videos, from anyone with
 * the link.
 *
 * Recordings are played with the browser's own controls rather than a custom
 * player: guests are on every device imaginable, and the native control is the one
 * that works on all of them.
 */
export default async function PublicGuestBookPage({ params }: Params) {
  const { slug } = await params;
  const loaded = await loadPublicGuestBook(slug);
  if (!loaded) notFound();

  const { site, entries } = loaded;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface px-5 py-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-clay">
          {site.wedding.title}
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink">Guest book</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {formatLongDate(site.wedding.weddingDate)}
        </p>
        {site.guestBookNote && (
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
            {site.guestBookNote}
          </p>
        )}
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-6 p-5 sm:p-8">
        <GuestBookForm slug={site.slug} />

        {entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">
            No messages yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-2xl border border-line bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base text-ink">
                    {entry.guestName}
                  </span>
                  {entry.kind !== "TEXT" && (
                    <Badge tone="clay">{GUEST_BOOK_KIND_LABELS[entry.kind]}</Badge>
                  )}
                  <span className="ml-auto text-xs text-ink-faint">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>

                {entry.upload && (
                  <div className="mt-3">
                    {entry.kind === "VOICE" ? (
                      <audio
                        controls
                        preload="none"
                        src={`/api/files/${entry.upload.id}`}
                        className="w-full"
                      />
                    ) : (
                      <video
                        controls
                        preload="none"
                        src={`/api/files/${entry.upload.id}`}
                        className="max-h-80 w-full rounded-xl bg-black"
                      />
                    )}
                  </div>
                )}

                {entry.message && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                    {entry.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
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
