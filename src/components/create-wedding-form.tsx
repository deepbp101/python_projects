"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorMessage, Field, Input } from "@/components/ui";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { parseMoney } from "@/lib/money";

type CreatedWedding = { wedding: { id: string } };

export function CreateWeddingForm({ hasExisting }: { hasExisting: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!hasExisting);
  const [title, setTitle] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [venueName, setVenueName] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Plan another wedding
      </Button>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const totalBudget = budget.trim() === "" ? 0 : parseMoney(budget);
    if (totalBudget === null) {
      setError("That budget doesn't look like a number.");
      setBusy(false);
      return;
    }

    try {
      const result = await apiFetch<CreatedWedding>("/api/weddings", {
        method: "POST",
        body: {
          title,
          weddingDate,
          venueName: venueName || null,
          location: location || null,
          totalBudget,
          seedTimeline: true,
          seedBudget: totalBudget > 0,
        },
      });
      router.push(`/w/${result.wedding.id}/dashboard`);
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-lg text-ink">
        {hasExisting ? "Plan another wedding" : "Set up your wedding"}
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        We&rsquo;ll build your checklist from the date, and split the budget
        across the usual categories to get you started.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field label="What should we call it?">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Sam & Alex's Wedding"
            required
            maxLength={160}
          />
        </Field>

        <Field label="Wedding date">
          <Input
            type="date"
            value={weddingDate}
            onChange={(event) => setWeddingDate(event.target.value)}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Venue (optional)">
            <Input
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              placeholder="The Old Mill"
            />
          </Field>
          <Field label="Location (optional)">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Hudson Valley, NY"
            />
          </Field>
        </div>

        <Field
          label="Total budget (optional)"
          hint="You can change this at any time."
        >
          <Input
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            inputMode="decimal"
            placeholder="35,000"
          />
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Setting things up…" : "Create wedding"}
          </Button>
          {hasExisting && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
