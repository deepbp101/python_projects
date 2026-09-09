import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateWeddingForm } from "@/components/create-wedding-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth/session";
import { countdownTo, formatLongDate } from "@/lib/dates";
import { listWeddingsForUser } from "@/lib/services/wedding";

export const metadata: Metadata = { title: "Your weddings" };

export default async function WeddingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/weddings");

  const weddings = await listWeddingsForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-clay">
            Wedding Planner
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">
            Hello, {user.name.split(" ")[0]}
          </h1>
        </div>
        <SignOutButton />
      </div>

      {weddings.length > 0 && (
        <ul className="mt-8 space-y-3">
          {weddings.map((wedding) => {
            const remaining = countdownTo(wedding.weddingDate);
            return (
              <li key={wedding.id}>
                <Link
                  href={`/w/${wedding.id}/dashboard`}
                  className="block rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-clay"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-display text-xl text-ink">
                      {wedding.title}
                    </h2>
                    <span className="tabular text-sm text-ink-soft">
                      {remaining.hasPassed
                        ? "Married 🤍"
                        : `${remaining.days} days to go`}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    {formatLongDate(wedding.weddingDate)}
                    {wedding.venueName ? ` · ${wedding.venueName}` : ""}
                  </p>
                  <p className="mt-3 text-xs text-ink-faint">
                    {wedding._count.guests} guests · {wedding._count.tasks} tasks
                    · your role: {wedding.role.toLowerCase()}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        <CreateWeddingForm hasExisting={weddings.length > 0} />
      </div>
    </main>
  );
}
