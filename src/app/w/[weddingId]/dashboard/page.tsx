import type { Metadata } from "next";
import Link from "next/link";
import { CountdownWidget } from "@/components/countdown-widget";
import { Badge, Card, CardTitle, ProgressBar, Stat } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { prisma } from "@/lib/db";
import { summarizeBudget, upcomingPayments } from "@/lib/domain/budget";
import { countRsvps } from "@/lib/domain/rsvp";
import { summarizeProgress } from "@/lib/domain/timeline";
import { formatMoney } from "@/lib/money";
import { canSee, loadWorkspace } from "@/lib/page";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { wedding, access, user } = await loadWorkspace(weddingId);

  const showTasks = canSee(access, "TASKS");
  const showBudget = canSee(access, "BUDGET");
  const showGuests = canSee(access, "GUESTS");

  const [tasks, categories, items, guests] = await Promise.all([
    showTasks
      ? prisma.task.findMany({
          where: { weddingId },
          orderBy: [{ dueDate: "asc" }],
        })
      : Promise.resolve([]),
    showBudget
      ? prisma.budgetCategory.findMany({ where: { weddingId } })
      : Promise.resolve([]),
    showBudget
      ? prisma.budgetItem.findMany({
          where: { weddingId },
          include: { payments: true },
        })
      : Promise.resolve([]),
    showGuests
      ? prisma.guest.findMany({ where: { weddingId }, include: { rsvp: true } })
      : Promise.resolve([]),
  ]);

  const progress = summarizeProgress(tasks);
  const budget = summarizeBudget(wedding.totalBudget, categories, items);
  const reminders = upcomingPayments(items, { withinDays: 30 });
  const rsvp = countRsvps(guests);

  const nextTasks = tasks
    .filter((task) => !task.completedAt)
    .slice(0, 5);

  /**
   * The things asking for a decision, pulled to the top.
   *
   * Every one of these was already on the page, but each sat partway down its own
   * card — so "one payment is three days late" was three scrolls below a
   * countdown. Opening the app should answer "does anything need me?" before it
   * answers anything else. When nothing does, the strip is absent rather than
   * cheerfully empty: silence is the good outcome.
   */
  const overduePayments = reminders.filter((reminder) => reminder.isOverdue);
  const attention = [
    progress.overdue > 0 && {
      key: "tasks",
      href: `/w/${weddingId}/checklist`,
      count: progress.overdue,
      label: progress.overdue === 1 ? "task is overdue" : "tasks are overdue",
      tone: "danger" as const,
    },
    overduePayments.length > 0 && {
      key: "payments",
      href: `/w/${weddingId}/budget`,
      count: overduePayments.length,
      label:
        overduePayments.length === 1
          ? "payment is past due"
          : "payments are past due",
      tone: "danger" as const,
    },
    budget.alerts.length > 0 && {
      key: "budget",
      href: `/w/${weddingId}/budget`,
      count: budget.alerts.length,
      label:
        budget.alerts.length === 1
          ? "category is near its cap"
          : "categories are near their caps",
      tone: "alert" as const,
    },
    rsvp.pending > 0 && {
      key: "rsvp",
      href: `/w/${weddingId}/guests`,
      count: rsvp.pending,
      label: rsvp.pending === 1 ? "guest hasn't replied" : "guests haven't replied",
      tone: "alert" as const,
    },
  ].filter((entry): entry is Exclude<typeof entry, false> => Boolean(entry));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
      <div>
        <h1 className="font-display text-2xl text-ink">
          Good to see you, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          {wedding.venueName ?? "Venue to be decided"}
          {wedding.location ? ` · ${wedding.location}` : ""}
        </p>
      </div>

      {attention.length > 0 && (
        <section aria-labelledby="needs-you">
          <h2
            id="needs-you"
            className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint"
          >
            Needs you
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {attention.map((entry) => (
              <li key={entry.key}>
                <Link
                  href={entry.href}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 transition-colors hover:bg-surface-sunk"
                >
                  <Badge tone={entry.tone}>{entry.count}</Badge>
                  <span className="flex-1 text-sm text-ink">{entry.label}</span>
                  <span aria-hidden className="text-ink-faint">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CountdownWidget weddingDate={wedding.weddingDate.toISOString()} />

      <div className="grid gap-5 lg:grid-cols-2">
        {showTasks && (
          <Card>
            <CardTitle
              action={
                <Link
                  href={`/w/${weddingId}/checklist`}
                  className="text-sm text-clay-dark underline underline-offset-2"
                >
                  Open
                </Link>
              }
            >
              Checklist
            </CardTitle>

            <div className="flex items-end justify-between gap-4">
              <Stat
                label="Complete"
                value={`${progress.percentComplete}%`}
                hint={`${progress.completed} of ${progress.total} tasks`}
              />
              <div className="flex gap-2">
                {progress.overdue > 0 && (
                  <Badge tone="danger">{progress.overdue} overdue</Badge>
                )}
                {progress.dueThisWeek > 0 && (
                  <Badge tone="alert">{progress.dueThisWeek} this week</Badge>
                )}
              </div>
            </div>

            <div className="mt-3">
              <ProgressBar
                value={progress.percentComplete}
                tone="sage"
                label="Checklist progress"
              />
            </div>

            <ul className="mt-4 space-y-2">
              {nextTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-ink">{task.title}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatDate(task.dueDate)}
                  </span>
                </li>
              ))}
              {nextTasks.length === 0 && (
                <li className="text-sm text-ink-soft">
                  Everything on the checklist is done. 🤍
                </li>
              )}
            </ul>
          </Card>
        )}

        {showBudget && (
          <Card>
            <CardTitle
              action={
                <Link
                  href={`/w/${weddingId}/budget`}
                  className="text-sm text-clay-dark underline underline-offset-2"
                >
                  Open
                </Link>
              }
            >
              Budget
            </CardTitle>

            <div className="flex items-end justify-between gap-4">
              <Stat
                label="Spent"
                value={formatMoney(budget.totalPaid, wedding.currency)}
                hint={`of ${formatMoney(budget.totalBudget, wedding.currency)}`}
              />
              <Stat
                label="Still owed"
                value={formatMoney(budget.totalOutstanding, wedding.currency)}
              />
            </div>

            <div className="mt-3">
              <ProgressBar
                value={budget.percentUsed}
                tone={
                  budget.status === "OVER"
                    ? "danger"
                    : budget.status === "WARNING"
                      ? "alert"
                      : "clay"
                }
                label="Budget used"
              />
            </div>

            {budget.alerts.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {budget.alerts.slice(0, 3).map((category) => (
                  <li key={category.id} className="flex justify-between gap-3">
                    <span className="text-ink">{category.name}</span>
                    <Badge tone={category.status === "OVER" ? "danger" : "alert"}>
                      {category.percentUsed}% used
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            {reminders.length > 0 && (
              <div className="mt-4 rounded-xl bg-surface-sunk p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
                  Payments due
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {reminders.slice(0, 3).map((reminder) => (
                    <li
                      key={reminder.paymentId}
                      className="flex justify-between gap-3"
                    >
                      <span className="text-ink">
                        {reminder.itemName}
                        <span className="text-ink-faint"> · {reminder.label}</span>
                      </span>
                      <span
                        className={
                          reminder.isOverdue
                            ? "shrink-0 text-danger"
                            : "shrink-0 text-ink-soft"
                        }
                      >
                        {reminder.isOverdue
                          ? `${Math.abs(reminder.daysUntilDue)}d overdue`
                          : `in ${reminder.daysUntilDue}d`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {showGuests && (
          <Card className="lg:col-span-2">
            <CardTitle
              action={
                <Link
                  href={`/w/${weddingId}/guests`}
                  className="text-sm text-clay-dark underline underline-offset-2"
                >
                  Open
                </Link>
              }
            >
              Guests
            </CardTitle>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Invited" value={rsvp.totalInvited} />
              <Stat
                label="Attending"
                value={rsvp.attending}
                hint={`${rsvp.attendingAdults} adults · ${rsvp.attendingChildren} children`}
              />
              <Stat label="Declined" value={rsvp.declined} />
              <Stat
                label="Awaiting reply"
                value={rsvp.pending}
                hint={`${rsvp.responseRate}% responded`}
              />
            </div>

            <div className="mt-4">
              <ProgressBar
                value={rsvp.responseRate}
                tone="rose"
                label="RSVP response rate"
              />
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
