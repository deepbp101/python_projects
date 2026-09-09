import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

const FEATURES = [
  {
    title: "A checklist that knows your date",
    body: "Set the wedding date and the whole timeline builds itself — 12 months out down to the morning of.",
  },
  {
    title: "A budget you can trust",
    body: "Planned against actual, deposits and final payments tracked separately, and a nudge before a category runs over.",
  },
  {
    title: "Guests and RSVPs in one place",
    body: "Households, plus-ones, meal choices and dietary needs — with the headcount your caterer keeps asking for.",
  },
  {
    title: "Everyone in sync",
    body: "Invite your partner, your planner and family. Changes appear for everyone as they happen, with access you control per section.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/weddings");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-12 sm:py-20">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-clay">
          Wedding Planner
        </p>
        <h1 className="mt-4 font-display text-4xl leading-tight text-ink sm:text-5xl">
          One calm place to plan the whole wedding.
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-soft">
          Checklist, budget, guest list and a countdown — shared with whoever is
          helping, updating live as you go.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/signup"
            className="rounded-full bg-clay px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-clay-dark"
          >
            Start planning
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-line-strong px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunk"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mt-16 grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-line bg-surface p-5"
          >
            <h2 className="font-display text-lg text-ink">{feature.title}</h2>
            <p className="mt-2 text-sm text-ink-soft">{feature.body}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
