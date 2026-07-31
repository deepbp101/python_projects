import clsx from "clsx";
import { PlanUnlock } from "@/components/plan-unlock";
import { Badge, Card, CardTitle } from "@/components/ui";
import type { Plan } from "@/generated/prisma/enums";
import { formatLongDate } from "@/lib/dates";
import {
  describeLimit,
  limitFor,
  planDefinition,
  UNLIMITED,
  type CountableLimit,
  type PlanFeature,
} from "@/lib/domain/plans";

/**
 * What this wedding's plan allows, and how much of it is spent.
 *
 * Reads the same table the server enforces against (`@/lib/domain/plans`), so the
 * numbers here cannot drift from the ones that actually refuse a request.
 *
 * Pro is a one-time unlock, so there is a code field rather than a checkout — and
 * once redeemed, a date rather than a renewal notice. Nothing on this page can
 * take Pro away again: downgrading a couple who paid is not a button.
 */

const LIMIT_LABELS: Record<CountableLimit, string> = {
  guests: "Guests",
  collaborators: "Helpers",
  vendors: "Vendors",
  moodBoardItems: "Mood board items",
  galleryPhotos: "Gallery photos",
  guestBookEntries: "Guest book entries",
  seatingTables: "Tables",
  aiDrafts: "Saved AI drafts",
};

const FEATURE_LABELS: Record<PlanFeature, string> = {
  aiWriting: "Writing assistant",
  styleMatchmaker: "Style matchmaker",
  vendorThreads: "Vendor messaging",
  guestBookRecordings: "Voice & video guest book",
  venueTours: "Virtual venue tours",
  moodBoardSharing: "Mood board sharing",
  customTimeline: "Editable timeline templates",
};

/** A quiet bar until it isn't: amber past 80%, clay when full. */
function Meter({ used, of }: { used: number; of: number }) {
  if (of === UNLIMITED) return null;
  const fraction = of === 0 ? 1 : Math.min(1, used / of);

  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
      <div
        className={clsx(
          "h-full rounded-full transition-[width]",
          fraction >= 1 ? "bg-clay" : fraction >= 0.8 ? "bg-alert" : "bg-sage",
        )}
        style={{ width: `${Math.max(fraction * 100, 2)}%` }}
      />
    </div>
  );
}

export function PlanPanel({
  weddingId,
  plan,
  unlockedAt,
  isOwner,
  usage,
  counts,
}: {
  weddingId: string;
  plan: Plan;
  unlockedAt: Date | null;
  /** Only the couple can redeem a code, so only they are shown the field. */
  isOwner: boolean;
  usage: {
    period: string;
    used: number;
    requests: number;
    allowance: number;
    remaining: number;
  };
  counts: Record<CountableLimit, number>;
}) {
  const definition = planDefinition(plan);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Your plan</CardTitle>
          <p className="text-sm text-ink-soft">{definition.blurb}</p>
        </div>
        <Badge tone={plan === "PRO" ? "sage" : "neutral"}>
          {definition.label}
        </Badge>
      </div>

      <section className="mt-5">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Writing assistant
        </h3>
        <p className="mt-1.5 text-sm text-ink">
          <span className="tabular">{usage.used.toLocaleString("en-US")}</span>{" "}
          of{" "}
          <span className="tabular">
            {usage.allowance.toLocaleString("en-US")}
          </span>{" "}
          tokens used
          {usage.requests > 0 && (
            <span className="text-ink-soft">
              {" "}
              across {usage.requests.toLocaleString("en-US")}{" "}
              {usage.requests === 1 ? "request" : "requests"}
            </span>
          )}
        </p>
        <Meter used={usage.used} of={usage.allowance} />
        <p className="mt-1.5 text-xs text-ink-faint">
          This is the whole allowance for your wedding, not a monthly one — spend
          it whenever suits. Each draft is capped at{" "}
          {definition.aiMaxOutputTokens.toLocaleString("en-US")} tokens of output.
        </p>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Allowances
        </h3>
        <dl className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {(Object.keys(LIMIT_LABELS) as CountableLimit[]).map((limit) => {
            const max = limitFor(plan, limit);
            return (
              <div key={limit}>
                <div className="flex items-baseline justify-between gap-2">
                  <dt className="text-sm text-ink-soft">
                    {LIMIT_LABELS[limit]}
                  </dt>
                  <dd className="tabular text-sm text-ink">
                    {counts[limit].toLocaleString("en-US")}
                    <span className="text-ink-faint"> / {describeLimit(max)}</span>
                  </dd>
                </div>
                <Meter used={counts[limit]} of={max} />
              </div>
            );
          })}
        </dl>
      </section>

      <section className="mt-6">
        <h3 className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          Features
        </h3>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {(Object.keys(FEATURE_LABELS) as PlanFeature[]).map((feature) => {
            const on = definition.features[feature];
            return (
              <li
                key={feature}
                className={clsx(
                  "flex items-center gap-2 text-sm",
                  on ? "text-ink" : "text-ink-faint",
                )}
              >
                <span aria-hidden className={on ? "text-sage" : "text-line-strong"}>
                  {on ? "✓" : "—"}
                </span>
                {FEATURE_LABELS[feature]}
                {!on && <span className="text-xs text-clay-dark">Pro</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-6 border-t border-line pt-4">
        {plan === "FREE" ? (
          <>
            <p className="text-sm text-ink-soft">
              Pro lifts every cap and turns on vendor messaging, venue tours and
              recorded guest book entries. It&rsquo;s unlocked once for this
              wedding and never expires — you&rsquo;re planning a day, not
              subscribing to one.
            </p>
            {isOwner ? (
              <PlanUnlock weddingId={weddingId} />
            ) : (
              <p className="mt-3 text-sm text-ink-faint">
                Only the couple can unlock Pro.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-soft">
            Pro is unlocked for this wedding
            {unlockedAt && <> — redeemed {formatLongDate(unlockedAt)}</>}. There
            is nothing to renew and nothing to cancel.
          </p>
        )}
      </div>
    </Card>
  );
}
