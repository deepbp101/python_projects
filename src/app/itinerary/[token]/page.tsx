import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RsvpForm } from "@/components/rsvp-form";
import { Badge, Card, CardTitle } from "@/components/ui";
import { formatLongDate, timeZoneLabel } from "@/lib/dates";
import { loadItineraryByToken } from "@/lib/services/celebrations";

type Params = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Your day",
  robots: { index: false },
};

/**
 * One guest's personal itinerary.
 *
 * Only their own details: their events, their table, their meal. No other guest
 * appears here, and neither does anything about the budget or the vendors — see
 * `loadItineraryByToken` for the exact field list.
 *
 * A guest who declined, or has not replied, sees the date and a nudge rather than a
 * schedule. Handing arrival times and a table number to someone who said no is
 * worse than sending nothing.
 */
export default async function ItineraryPage({ params }: Params) {
  const { token } = await params;
  const loaded = await loadItineraryByToken(token);
  if (!loaded) notFound();

  const { wedding, itinerary, reply } = loaded;
  const zone = timeZoneLabel(wedding.timezone);

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface px-5 py-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-clay">
          {wedding.title}
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink">
          {itinerary.guestName}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {formatLongDate(wedding.weddingDate)}
          {wedding.venueName && ` · ${wedding.venueName}`}
        </p>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-5 p-5 sm:p-8">
        {!itinerary.showSchedule ? (
          <Card>
            <CardTitle>
              {itinerary.status === "DECLINED"
                ? "We'll miss you"
                : "We haven't heard from you yet"}
            </CardTitle>
            <p className="text-sm text-ink-soft">
              {itinerary.status === "DECLINED"
                ? "You've let the couple know you can't make it, so there's nothing here for you to plan around."
                : "Once you've replied, this page will show your schedule for the day, your table and your meal."}
            </p>
            {wedding.siteSlug && (
              <p className="mt-3 text-sm">
                <Link
                  href={`/wedding/${wedding.siteSlug}`}
                  className="text-clay-dark underline underline-offset-4"
                >
                  See the wedding details
                </Link>
              </p>
            )}
          </Card>
        ) : (
          <>
            {(itinerary.seating || itinerary.meal || itinerary.plusOneName) && (
              <Card>
                <CardTitle>Your details</CardTitle>
                <dl className="grid gap-3 sm:grid-cols-3">
                  {itinerary.seating && (
                    <div>
                      <dt className="text-xs text-ink-faint">Your table</dt>
                      <dd className="font-display text-lg text-ink">
                        {itinerary.seating.tableName}
                      </dd>
                    </div>
                  )}
                  {itinerary.meal?.name && (
                    <div>
                      <dt className="text-xs text-ink-faint">Your meal</dt>
                      <dd className="text-sm text-ink">{itinerary.meal.name}</dd>
                    </div>
                  )}
                  {itinerary.plusOneName && (
                    <div>
                      <dt className="text-xs text-ink-faint">Coming with you</dt>
                      <dd className="text-sm text-ink">{itinerary.plusOneName}</dd>
                    </div>
                  )}
                </dl>
                {itinerary.meal?.dietaryRestrictions && (
                  <p className="mt-3 border-t border-line pt-3 text-xs text-ink-soft">
                    Noted for the kitchen: {itinerary.meal.dietaryRestrictions}
                  </p>
                )}
                {itinerary.status === "MAYBE" && (
                  <p className="mt-3">
                    <Badge tone="alert">
                      You&rsquo;re down as a maybe — let them know either way when you can
                    </Badge>
                  </p>
                )}
              </Card>
            )}

            <Card>
              <CardTitle>
                Your schedule{" "}
                <span className="text-xs font-normal text-ink-faint">
                  all times {zone}
                </span>
              </CardTitle>

              {itinerary.events.length === 0 ? (
                <p className="text-sm text-ink-soft">
                  The couple haven&rsquo;t published the timings yet.
                </p>
              ) : (
                <ol className="space-y-4">
                  {itinerary.events.map((event) => (
                    <li
                      key={event.id}
                      className="border-l-2 border-clay-soft pl-4"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-3">
                        <span className="tabular font-display text-base text-ink">
                          {event.timeLabel}
                        </span>
                        <span className="text-sm font-medium text-ink">
                          {event.name}
                        </span>
                      </div>
                      {event.venueName && (
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {event.venueName}
                          {event.address && ` — ${event.address}`}
                        </p>
                      )}
                      {event.dressCode && (
                        <p className="mt-0.5 text-xs text-ink-faint">
                          Dress: {event.dressCode}
                        </p>
                      )}
                      {event.description && (
                        <p className="mt-1 text-sm text-ink-soft">
                          {event.description}
                        </p>
                      )}
                      {event.mapUrl && (
                        <a
                          href={event.mapUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs text-clay-dark underline underline-offset-2"
                        >
                          Directions
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            {wedding.travel && (
              <Card>
                <CardTitle>{wedding.travelTitle ?? "Travel & stays"}</CardTitle>
                <p className="whitespace-pre-wrap text-sm text-ink-soft">
                  {wedding.travel}
                </p>
              </Card>
            )}
          </>
        )}

        {/*
          Shown either way. A guest who hasn't replied needs it most, and one who
          has may need to change their answer — the same form does both.
        */}
        <RsvpForm
          token={token}
          guestName={itinerary.guestName}
          deadline={wedding.rsvpDeadline?.toISOString() ?? null}
          note={wedding.rsvpNote}
          meals={wedding.mealOptions}
          current={reply}
        />

        {wedding.siteSlug && itinerary.showSchedule && (
          <p className="text-center text-sm">
            <Link
              href={`/wedding/${wedding.siteSlug}`}
              className="text-clay-dark underline underline-offset-4"
            >
              Everything else about the day
            </Link>
          </p>
        )}
      </main>

      <footer className="px-5 pb-10 text-center text-xs text-ink-faint">
        This page is just for you — please don&rsquo;t pass the link on.
      </footer>
    </div>
  );
}
