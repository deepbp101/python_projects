"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import type { RsvpStatus } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatLongDate } from "@/lib/dates";

type Reply = "ATTENDING" | "DECLINED" | "MAYBE";

const REPLY_LABELS: Record<Reply, string> = {
  ATTENDING: "Yes, I'll be there",
  MAYBE: "I'm not sure yet",
  DECLINED: "Sorry, I can't make it",
};

export type MealOption = { id: string; name: string; description: string | null };

/**
 * The guest's reply, on their own link.
 *
 * Answering is one tap; everything else — meal, dietary note, a message, a
 * plus-one — only appears once they say yes, because a guest who cannot come
 * should not be walked through a menu. Replies can be changed: plans move, and a
 * form that works once just becomes a phone call to the couple.
 */
export function RsvpForm({
  token,
  guestName,
  deadline,
  note,
  meals,
  current,
}: {
  token: string;
  guestName: string;
  deadline: string | null;
  note: string | null;
  meals: MealOption[];
  current: {
    status: RsvpStatus | null;
    mealOptionId: string | null;
    message: string | null;
    dietaryRestrictions: string | null;
    plusOne: {
      name: string;
      status: RsvpStatus | null;
      mealOptionId: string | null;
    } | null;
  };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const asReply = (status: RsvpStatus | null): Reply | null =>
    status === "ATTENDING" || status === "DECLINED" || status === "MAYBE"
      ? status
      : null;

  const [status, setStatus] = useState<Reply | null>(asReply(current.status));
  const [mealOptionId, setMealOptionId] = useState(current.mealOptionId ?? "");
  const [dietary, setDietary] = useState(current.dietaryRestrictions ?? "");
  const [message, setMessage] = useState(current.message ?? "");
  const [plusOneStatus, setPlusOneStatus] = useState<Reply | null>(
    asReply(current.plusOne?.status ?? null),
  );
  const [plusOneMeal, setPlusOneMeal] = useState(
    current.plusOne?.mealOptionId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const coming = status === "ATTENDING" || status === "MAYBE";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!status) {
      setError("Let them know either way.");
      return;
    }

    setBusy(true);
    setError(null);
    setSaved(false);

    try {
      await apiFetch(`/api/itinerary/${encodeURIComponent(token)}/rsvp`, {
        method: "POST",
        body: {
          status,
          mealOptionId: coming && mealOptionId ? mealOptionId : null,
          dietaryRestrictions: coming ? dietary || null : null,
          message: message || null,
          ...(current.plusOne && coming && plusOneStatus
            ? {
                plusOneStatus,
                plusOneMealOptionId: plusOneMeal || null,
              }
            : {}),
        },
      });
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>
        {current.status && current.status !== "PENDING"
          ? "Change your reply"
          : `Will you be there, ${guestName.split(" ")[0]}?`}
      </CardTitle>

      {deadline && (
        <p className="mb-3 text-sm text-ink-soft">
          They&rsquo;d like to know by {formatLongDate(deadline)}.
        </p>
      )}
      {note && <p className="mb-4 text-sm text-ink-soft">{note}</p>}

      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="sr-only">Your reply</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(REPLY_LABELS) as Reply[]).map((option) => (
              <label
                key={option}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  status === option
                    ? "border-clay bg-clay-soft text-clay-dark"
                    : "border-line bg-surface text-ink-soft hover:bg-surface-sunk",
                )}
              >
                <input
                  type="radio"
                  name="status"
                  checked={status === option}
                  onChange={() => setStatus(option)}
                  className="h-4 w-4 border-line-strong text-clay focus:ring-clay/30"
                />
                {REPLY_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>

        {coming && meals.length > 0 && (
          <Field label="What would you like to eat?">
            <Select
              value={mealOptionId}
              onChange={(event) => setMealOptionId(event.target.value)}
            >
              <option value="">No preference</option>
              {meals.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.name}
                  {meal.description ? ` — ${meal.description}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {coming && (
          <Field
            label="Anything the kitchen should know?"
            hint="Allergies, or anything you can't eat."
          >
            <Input
              value={dietary}
              maxLength={500}
              onChange={(event) => setDietary(event.target.value)}
              placeholder="No shellfish, please"
            />
          </Field>
        )}

        {coming && current.plusOne && (
          <div className="space-y-3 rounded-xl border border-line bg-surface-sunk p-3">
            <p className="text-sm font-medium text-ink">
              And {current.plusOne.name}?
            </p>
            <Select
              value={plusOneStatus ?? ""}
              onChange={(event) =>
                setPlusOneStatus((event.target.value || null) as Reply | null)
              }
              aria-label={`Reply for ${current.plusOne.name}`}
            >
              <option value="">Not sure yet</option>
              {(Object.keys(REPLY_LABELS) as Reply[]).map((option) => (
                <option key={option} value={option}>
                  {REPLY_LABELS[option]}
                </option>
              ))}
            </Select>
            {plusOneStatus === "ATTENDING" && meals.length > 0 && (
              <Select
                value={plusOneMeal}
                onChange={(event) => setPlusOneMeal(event.target.value)}
                aria-label={`Meal for ${current.plusOne.name}`}
              >
                <option value="">No preference</option>
                {meals.map((meal) => (
                  <option key={meal.id} value={meal.id}>
                    {meal.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        <Field label="A note for them (optional)">
          <Textarea
            rows={2}
            value={message}
            maxLength={1000}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Can't wait."
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy || !status}>
            {busy ? "Sending…" : current.status ? "Update my reply" : "Send my reply"}
          </Button>
          {saved && <span className="text-sm text-sage">Thank you — got it.</span>}
        </div>
      </form>
    </Card>
  );
}

/**
 * "Find your invitation" on the public site.
 *
 * Matches a full name to one guest and hands back their personal link. Names are
 * not secrets, so this is rate limited and returns nothing on an ambiguous match —
 * see the route for the full reasoning.
 */
export function RsvpLookup({ slug }: { slug: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const found = await apiFetch<{
        found: boolean;
        url: string | null;
        message: string | null;
      }>(`/api/public/${encodeURIComponent(slug)}/rsvp-lookup`, {
        method: "POST",
        body: { firstName, lastName },
      });

      if (found.found && found.url) {
        router.push(found.url);
        return;
      }
      setResult(found.message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 w-full max-w-md space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          placeholder="First name"
          aria-label="First name"
        />
        <Input
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          placeholder="Last name"
          aria-label="Last name"
        />
      </div>

      {result && <p className="text-sm opacity-80">{result}</p>}
      <ErrorMessage>{error}</ErrorMessage>

      <Button type="submit" disabled={busy}>
        {busy ? "Looking…" : "Find my invitation"}
      </Button>
    </form>
  );
}
