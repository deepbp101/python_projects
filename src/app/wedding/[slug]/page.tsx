import clsx from "clsx";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RsvpLookup } from "@/components/rsvp-form";
import { SITE_TEMPLATES } from "@/components/site/templates";
import { formatLongDate, timeZoneLabel } from "@/lib/dates";
import { formatEventWindow } from "@/lib/domain/itinerary";
import { loadPublishedSite } from "@/lib/services/site";

type Params = { params: Promise<{ slug: string }> };

/**
 * The couple's public wedding site.
 *
 * No auth, no workspace data — only what the couple has written and published.
 * An unpublished or unknown slug is a 404, so a draft never leaks.
 */

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  if (!site) return { title: "Not found" };

  const title = site.headline?.trim() || site.wedding.title;
  return {
    // Absolute, so the public site doesn't inherit the app's title template.
    title: { absolute: title },
    description:
      site.intro?.slice(0, 200) ??
      `${title} — ${formatLongDate(site.wedding.weddingDate)}`,
    robots: { index: false },
  };
}


export default async function PublicWeddingSite({ params }: Params) {
  const { slug } = await params;
  const site = await loadPublishedSite(slug);
  if (!site) notFound();

  const theme = SITE_TEMPLATES[site.template];
  const headline = site.headline?.trim() || site.wedding.title;

  return (
    <div className={clsx("min-h-dvh", theme.page)}>
      <header className={clsx("px-6 py-16 sm:py-24", theme.hero)}>
        <div className={clsx("mx-auto flex max-w-3xl flex-col", theme.align)}>
          <p className={clsx("text-[11px] font-medium uppercase", theme.eyebrow)}>
            {formatLongDate(site.wedding.weddingDate)}
          </p>
          <h1
            className={clsx(
              "mt-4 text-4xl leading-tight sm:text-6xl",
              theme.heading,
            )}
          >
            {headline}
          </h1>
          {site.intro && (
            <p className="mt-5 max-w-xl text-base opacity-80 sm:text-lg">
              {site.intro}
            </p>
          )}
        </div>
      </header>

      {site.coverImage && (
        <div className="mx-auto max-w-4xl px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- served from our own storage route, not an optimisable static asset */}
          <img
            src={`/api/files/${site.coverImage.id}`}
            alt=""
            width={site.coverImage.width ?? undefined}
            height={site.coverImage.height ?? undefined}
            className="w-full rounded-2xl object-cover"
          />
        </div>
      )}

      <main className="mx-auto max-w-3xl space-y-16 px-6 py-16 sm:py-20">
        {site.story && (
          <section className={clsx("flex flex-col", theme.align)}>
            <h2 className={clsx("text-2xl sm:text-3xl", theme.heading)}>
              {site.storyTitle}
            </h2>
            <div className={clsx("mt-2 h-px w-16", theme.rule)} />
            <div className="mt-5 space-y-4 text-base leading-relaxed opacity-90">
              {site.story.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {site.events.length > 0 && (
          <section className={clsx("flex flex-col", theme.align)}>
            <h2 className={clsx("text-2xl sm:text-3xl", theme.heading)}>
              The day
            </h2>
            <div className={clsx("mt-2 h-px w-16", theme.rule)} />
            <ul className="mt-6 w-full space-y-4">
              {site.events.map((event) => (
                <li
                  key={event.id}
                  className={clsx("rounded-2xl border p-5 text-left", theme.card)}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className={clsx("text-lg", theme.heading)}>
                      {event.name}
                    </h3>
                    {/*
                      Shown in the wedding's own timezone, shared with the
                      personal itineraries so there is one implementation of it —
                      a 4pm ceremony reads as 4pm for every guest.
                    */}
                    <span className={clsx("text-sm", theme.muted)}>
                      {formatEventWindow(event, site.wedding.timezone)}{" "}
                      <span className="opacity-70">
                        {timeZoneLabel(site.wedding.timezone)}
                      </span>
                    </span>
                  </div>
                  <p className={clsx("mt-1 text-sm", theme.muted)}>
                    {formatLongDate(event.startsAt)}
                  </p>
                  {event.venueName && (
                    <p className="mt-2 text-sm font-medium">{event.venueName}</p>
                  )}
                  {event.address && (
                    <p className={clsx("text-sm", theme.muted)}>{event.address}</p>
                  )}
                  {event.description && (
                    <p className="mt-2 text-sm opacity-90">{event.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.dressCode && (
                      <span
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs",
                          theme.chip,
                        )}
                      >
                        {event.dressCode}
                      </span>
                    )}
                    {event.mapUrl && (
                      <a
                        href={event.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={clsx(
                          "rounded-full px-3 py-1 text-xs underline underline-offset-2",
                          theme.chip,
                        )}
                      >
                        Directions
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {site.travel && (
          <section className={clsx("flex flex-col", theme.align)}>
            <h2 className={clsx("text-2xl sm:text-3xl", theme.heading)}>
              {site.travelTitle}
            </h2>
            <div className={clsx("mt-2 h-px w-16", theme.rule)} />
            <div className="mt-5 space-y-4 text-base leading-relaxed opacity-90">
              {site.travel.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {site.registry.length > 0 && (
          <section className={clsx("flex flex-col", theme.align)}>
            <h2 className={clsx("text-2xl sm:text-3xl", theme.heading)}>
              Registry
            </h2>
            <div className={clsx("mt-2 h-px w-16", theme.rule)} />
            {site.registryNote && (
              <p className="mt-4 max-w-xl text-base opacity-80">
                {site.registryNote}
              </p>
            )}
            <ul className="mt-6 w-full space-y-3">
              {site.registry.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "flex items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-opacity hover:opacity-80",
                      theme.card,
                    )}
                  >
                    <span>
                      <span className="font-medium">{link.label}</span>
                      {link.note && (
                        <span className={clsx("block text-sm", theme.muted)}>
                          {link.note}
                        </span>
                      )}
                    </span>
                    <span aria-hidden className={theme.muted}>
                      →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          Always shown, note or not: this is the one thing every guest arrives
          here to do. They find themselves by name and are handed their own
          link — the reply itself happens there, against a token, so nobody can
          answer for someone else by typing their name.
        */}
        <section
          className={clsx(
            "flex flex-col rounded-2xl border p-6",
            theme.card,
            theme.align,
          )}
        >
          <h2 className={clsx("text-xl", theme.heading)}>RSVP</h2>
          {site.rsvpDeadline && (
            <p className={clsx("mt-1 text-sm", theme.muted)}>
              Please reply by {formatLongDate(site.rsvpDeadline)}
            </p>
          )}
          {site.rsvpNote && (
            <p className="mt-3 max-w-xl text-base opacity-90">
              {site.rsvpNote}
            </p>
          )}
          <p className={clsx("mt-3 text-sm", theme.muted)}>
            Already have your personal link? Use that. Otherwise find yourself
            below.
          </p>
          <RsvpLookup slug={site.slug} />
        </section>

        {/*
          The gallery and guest book hang off this page rather than carrying links
          of their own — guests already have this one.
        */}
        {(site.galleryEnabled || site.guestBookEnabled) && (
          <section
            className={clsx(
              "flex flex-col rounded-2xl border p-6",
              theme.card,
              theme.align,
            )}
          >
            <h2 className={clsx("text-xl", theme.heading)}>Join in</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {site.galleryEnabled && (
                <Link
                  href={`/wedding/${site.slug}/gallery`}
                  className={clsx(
                    "rounded-full border px-5 py-2 text-sm transition-opacity hover:opacity-80",
                    theme.card,
                  )}
                >
                  Share your photos
                </Link>
              )}
              {site.guestBookEnabled && (
                <Link
                  href={`/wedding/${site.slug}/guestbook`}
                  className={clsx(
                    "rounded-full border px-5 py-2 text-sm transition-opacity hover:opacity-80",
                    theme.card,
                  )}
                >
                  Sign the guest book
                </Link>
              )}
            </div>
            {(site.galleryNote || site.guestBookNote) && (
              <p className={clsx("mt-3 max-w-xl text-sm", theme.muted)}>
                {site.galleryNote ?? site.guestBookNote}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className={clsx("px-6 pb-12 text-center text-xs", theme.muted)}>
        {headline} · {formatLongDate(site.wedding.weddingDate)}
      </footer>
    </div>
  );
}
