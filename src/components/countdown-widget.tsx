"use client";

import { useEffect, useState } from "react";
import { countdownTo, formatLongDate, type Countdown } from "@/lib/dates";

/**
 * The persistent countdown on the dashboard.
 *
 * Server and client each compute from their own clock, so the seconds can
 * differ by one on hydration. The changing numbers carry
 * `suppressHydrationWarning` rather than rendering a placeholder, which keeps
 * the real value visible in the first paint.
 */
export function CountdownWidget({
  weddingDate,
  compact = false,
}: {
  weddingDate: string;
  compact?: boolean;
}) {
  const [remaining, setRemaining] = useState<Countdown>(() =>
    countdownTo(new Date(weddingDate)),
  );

  useEffect(() => {
    const target = new Date(weddingDate);
    const tick = () => setRemaining(countdownTo(target));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [weddingDate]);

  if (compact) {
    return (
      <div className="tabular text-sm text-ink-soft" suppressHydrationWarning>
        {remaining.hasPassed ? (
          <span>Married! 🤍</span>
        ) : (
          <span>
            <strong className="text-ink">{remaining.days}</strong> days to go
          </span>
        )}
      </div>
    );
  }

  if (remaining.hasPassed) {
    return (
      <div className="rounded-2xl bg-clay-soft p-6 text-center">
        <p className="font-display text-2xl text-clay-dark">
          You&rsquo;re married! 🤍
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          {formatLongDate(weddingDate)}
        </p>
      </div>
    );
  }

  const units = [
    { label: "days", value: remaining.days },
    { label: "hours", value: remaining.hours },
    { label: "minutes", value: remaining.minutes },
    { label: "seconds", value: remaining.seconds },
  ];

  // Tighter on a phone than it used to be: at the old size this single block
  // filled the screen, so the things actually needing a decision started below
  // the fold. It is the emotional centre of the page, not the whole of it.
  return (
    <div className="rounded-2xl bg-gradient-to-br from-clay-soft to-rose-soft p-4 text-center sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-clay-dark">
        Counting down to
      </p>
      <p className="mt-0.5 font-display text-base text-ink sm:mt-1 sm:text-lg">
        {formatLongDate(weddingDate)}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2 sm:mt-4">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="rounded-xl bg-surface/70 px-1 py-2 sm:py-3"
          >
            <div
              className="tabular font-display text-xl text-ink sm:text-3xl"
              suppressHydrationWarning
            >
              {unit.value}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-ink-faint sm:text-[11px]">
              {unit.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
