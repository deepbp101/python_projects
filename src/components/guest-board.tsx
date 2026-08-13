"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  Disclosure,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  ProgressBar,
  Select,
  Stat,
  Textarea,
} from "@/components/ui";
import type { AgeGroup, RsvpStatus } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import type { DietaryNote, MealCount, RsvpCounts } from "@/lib/domain/rsvp";
import { RSVP_STATUS_LABELS } from "@/lib/domain/rsvp";
import { parseGuestCsv } from "@/lib/validation";

type BoardGuest = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  ageGroup: AgeGroup;
  dietaryRestrictions: string | null;
  plusOneAllowed: boolean;
  plusOneOfGuestId: string | null;
  householdName: string | null;
  tagIds: string[];
  rsvp: { status: RsvpStatus; mealOptionId: string | null } | null;
};

type Tag = { id: string; name: string; color: string };
type MealOption = { id: string; name: string };
type Household = { id: string; name: string };

const STATUS_TONE: Record<RsvpStatus, "neutral" | "sage" | "danger" | "alert"> = {
  PENDING: "neutral",
  ATTENDING: "sage",
  DECLINED: "danger",
  MAYBE: "alert",
};

export function GuestBoard({
  weddingId,
  canEdit,
  guests,
  households,
  tags,
  mealOptions,
  counts,
  meals,
  dietary,
}: {
  weddingId: string;
  canEdit: boolean;
  guests: BoardGuest[];
  households: Household[];
  tags: Tag[];
  mealOptions: MealOption[];
  counts: RsvpCounts;
  meals: MealCount[];
  dietary: DietaryNote[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<RsvpStatus | "">("");
  const [panel, setPanel] = useState<"none" | "add" | "import">("none");

  const refresh = () => startTransition(() => router.refresh());

  const visible = guests.filter((guest) => {
    const haystack =
      `${guest.firstName} ${guest.lastName} ${guest.email ?? ""} ${guest.householdName ?? ""}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (tagFilter && !guest.tagIds.includes(tagFilter)) return false;
    if (statusFilter && (guest.rsvp?.status ?? "PENDING") !== statusFilter) {
      return false;
    }
    return true;
  });

  async function setRsvp(
    guest: BoardGuest,
    changes: { status?: RsvpStatus; mealOptionId?: string | null },
  ) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/guests/${guest.id}/rsvp`, {
        method: "PUT",
        body: {
          status: changes.status ?? guest.rsvp?.status ?? "PENDING",
          mealOptionId:
            changes.mealOptionId !== undefined
              ? changes.mealOptionId
              : (guest.rsvp?.mealOptionId ?? null),
        },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function removeGuest(guestId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/guests/${guestId}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  // Before the first guest exists, the summary, the catering panels and the
  // search row are all reporting on nothing — five controls standing between a
  // couple and the one button they came for. They appear with the list.
  const hasGuests = guests.length > 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Guest list</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {counts.totalInvited} invited · {counts.attending} attending ·{" "}
            {counts.pending} awaiting reply
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                setPanel((current) => (current === "import" ? "none" : "import"))
              }
            >
              Import
            </Button>
            <Button
              onClick={() =>
                setPanel((current) => (current === "add" ? "none" : "add"))
              }
            >
              Add guest
            </Button>
          </div>
        )}
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      {hasGuests && (
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Invited" value={counts.totalInvited} />
          <Stat
            label="Attending"
            value={counts.attending}
            hint={`${counts.attendingAdults} adults · ${counts.attendingChildren} children`}
          />
          <Stat label="Declined" value={counts.declined} />
          <Stat
            label="Responded"
            value={`${counts.responseRate}%`}
            hint={`${counts.responded} of ${counts.totalInvited}`}
          />
        </div>
        <div className="mt-4">
          <ProgressBar
            value={counts.responseRate}
            tone="rose"
            label="RSVP response rate"
          />
        </div>
      </Card>
      )}

      {hasGuests && (
      /*
        Catering reference, not the day-to-day task. Both were stacked full
        height above the list, so on a phone you scrolled past two summaries
        every time you came to look someone up. Closed by default; the headline
        count stays on the summary line so nothing is lost by leaving them shut.
      */
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3 sm:p-4">
          <Disclosure
            summary={
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-base text-ink sm:text-lg">Meals</h2>
                <span className="tabular text-xs text-ink-faint">
                  {meals.length}
                </span>
              </div>
            }
          >
          <div className="mt-3">
          {meals.length === 0 ? (
            <p className="text-sm text-ink-soft">No meal options set up yet.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {meals.map((meal) => (
                <li
                  key={meal.mealOptionId ?? "none"}
                  className="flex justify-between"
                >
                  <span
                    className={
                      meal.mealOptionId ? "text-ink" : "text-ink-faint italic"
                    }
                  >
                    {meal.name}
                  </span>
                  <span className="tabular text-ink-soft">{meal.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            Counted for attending guests only.
          </p>
          </div>
          </Disclosure>
        </Card>

        <Card className="p-3 sm:p-4">
          <Disclosure
            summary={
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-base text-ink sm:text-lg">Dietary</h2>
                <span className="tabular text-xs text-ink-faint">
                  {dietary.length}
                </span>
              </div>
            }
          >
          <div className="mt-3">
          {dietary.length === 0 ? (
            <p className="text-sm text-ink-soft">
              Nothing noted yet for attending guests.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {dietary.map((note) => (
                <li key={note.guestId} className="flex justify-between gap-3">
                  <span className="text-ink">{note.guestName}</span>
                  <span className="text-right text-ink-soft">
                    {note.restriction}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </div>
          </Disclosure>
        </Card>
      </div>
      )}

      {panel === "add" && canEdit && (
        <AddGuestForm
          weddingId={weddingId}
          households={households}
          tags={tags}
          onDone={() => {
            setPanel("none");
            refresh();
          }}
        />
      )}

      {panel === "import" && canEdit && (
        <ImportGuestsForm
          weddingId={weddingId}
          onDone={() => {
            setPanel("none");
            refresh();
          }}
        />
      )}

      {hasGuests && (
      <div className="flex flex-wrap gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search guests"
          className="w-full sm:w-56"
          aria-label="Search guests"
        />
        {/*
          Paired on one row on a phone. Each control carries w-full from the
          shared control class, so a width utility here loses to it depending on
          stylesheet order; a wrapper that becomes `contents` at sm keeps the
          desktop row exactly as it was without that fight.
        */}
        <div className="flex w-full gap-2 sm:contents">
        <Select
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
          className="sm:w-40"
          aria-label="Filter by group"
        >
          <option value="">All groups</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.name}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as RsvpStatus | "")
          }
          className="sm:w-40"
          aria-label="Filter by RSVP"
        >
          <option value="">Any RSVP</option>
          {(Object.keys(RSVP_STATUS_LABELS) as RsvpStatus[]).map((status) => (
            <option key={status} value={status}>
              {RSVP_STATUS_LABELS[status]}
            </option>
          ))}
        </Select>
        </div>
      </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={guests.length === 0 ? "No guests yet" : "No matches"}
          description={
            guests.length === 0
              ? "Add guests one at a time, or paste a list to import them in bulk."
              : "Try a different search or filter."
          }
        />
      ) : (
        // One card holding divided rows rather than a card per guest: with
        // twenty-five guests the gaps and borders alone were most of the page.
        <Card className="p-3 sm:p-4">
        <ul className="divide-y divide-line">
          {visible.map((guest) => {
            const status = guest.rsvp?.status ?? "PENDING";
            return (
              <li key={guest.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium text-ink">
                          {guest.firstName} {guest.lastName}
                        </span>
                        {guest.plusOneOfGuestId && (
                          <Badge tone="clay">Plus-one</Badge>
                        )}
                        {guest.ageGroup !== "ADULT" && (
                          <Badge>{guest.ageGroup.toLowerCase()}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        {[guest.householdName, guest.email]
                          .filter(Boolean)
                          .join(" · ") || "No contact details"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {guest.tagIds.map((tagId) => {
                          const tag = tags.find((entry) => entry.id === tagId);
                          if (!tag) return null;
                          return (
                            <span
                              key={tagId}
                              className="rounded-full px-2 py-0.5 text-[11px]"
                              style={{
                                backgroundColor: `${tag.color}22`,
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                      </div>
                      {guest.dietaryRestrictions && (
                        <p className="mt-1.5 text-xs text-ink-soft">
                          Dietary: {guest.dietaryRestrictions}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canEdit ? (
                        <>
                          <Select
                            aria-label={`RSVP for ${guest.firstName}`}
                            value={status}
                            onChange={(event) =>
                              setRsvp(guest, {
                                status: event.target.value as RsvpStatus,
                              })
                            }
                            className="w-36 py-1 text-xs"
                          >
                            {(
                              Object.keys(RSVP_STATUS_LABELS) as RsvpStatus[]
                            ).map((option) => (
                              <option key={option} value={option}>
                                {RSVP_STATUS_LABELS[option]}
                              </option>
                            ))}
                          </Select>

                          {status === "ATTENDING" && mealOptions.length > 0 && (
                            <Select
                              aria-label={`Meal for ${guest.firstName}`}
                              value={guest.rsvp?.mealOptionId ?? ""}
                              onChange={(event) =>
                                setRsvp(guest, {
                                  mealOptionId: event.target.value || null,
                                })
                              }
                              className="w-32 py-1 text-xs"
                            >
                              <option value="">Meal…</option>
                              {mealOptions.map((meal) => (
                                <option key={meal.id} value={meal.id}>
                                  {meal.name}
                                </option>
                              ))}
                            </Select>
                          )}

                          <button
                            onClick={() => removeGuest(guest.id)}
                            aria-label={`Remove ${guest.firstName} ${guest.lastName}`}
                            className="rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <Badge tone={STATUS_TONE[status]}>
                          {RSVP_STATUS_LABELS[status]}
                        </Badge>
                      )}
                    </div>
                  </div>
              </li>
            );
          })}
        </ul>
        </Card>
      )}
    </main>
  );
}

function AddGuestForm({
  weddingId,
  households,
  tags,
  onDone,
}: {
  weddingId: string;
  households: Household[];
  tags: Tag[];
  onDone: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [householdId, setHouseholdId] = useState("");
  const [ageGroup, setAgeGroup] = useState<AgeGroup>("ADULT");
  const [dietary, setDietary] = useState("");
  const [plusOneAllowed, setPlusOneAllowed] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/guests`, {
        method: "POST",
        body: {
          firstName,
          lastName,
          email: email || null,
          householdId: householdId || null,
          ageGroup,
          dietaryRestrictions: dietary || null,
          plusOneAllowed,
          tagIds,
        },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            <Input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </Field>
          <Field label="Last name">
            <Input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </Field>
          <Field label="Email (optional)">
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Household (optional)">
            <Select
              value={householdId}
              onChange={(event) => setHouseholdId(event.target.value)}
            >
              <option value="">No household</option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Age group">
            <Select
              value={ageGroup}
              onChange={(event) => setAgeGroup(event.target.value as AgeGroup)}
            >
              <option value="ADULT">Adult</option>
              <option value="CHILD">Child</option>
              <option value="INFANT">Infant</option>
            </Select>
          </Field>
          <Field label="Dietary needs (optional)">
            <Input
              value={dietary}
              onChange={(event) => setDietary(event.target.value)}
              placeholder="Vegetarian, no nuts"
            />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-ink-soft">
            Groups
          </legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setTagIds((current) =>
                      selected
                        ? current.filter((entry) => entry !== tag.id)
                        : [...current, tag.id],
                    )
                  }
                  className={clsx(
                    "rounded-full px-3 py-1 text-xs transition-colors",
                    selected
                      ? "bg-ink text-canvas"
                      : "bg-surface-sunk text-ink-soft hover:text-ink",
                  )}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox"
            checked={plusOneAllowed}
            onChange={(event) => setPlusOneAllowed(event.target.checked)}
            className="h-4 w-4 accent-[var(--color-clay)]"
          />
          Allowed a plus-one
        </label>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add guest"}
        </Button>
      </form>
    </Card>
  );
}

function ImportGuestsForm({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = parseGuestCsv(text);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (parsed.length === 0) {
      setError("Nothing to import yet — add one guest per line.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/guests/import`, {
        method: "POST",
        body: { guests: parsed },
      });
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Paste your guest list"
          hint="One per line: First, Last, email, household, tag|tag. Only the first name is required."
        >
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={8}
            className="font-mono text-xs"
            placeholder={
              "Jordan, Ellis, jordan@example.com, The Ellis Family, Family\nRiley, Chen, , , Friends|Work"
            }
          />
        </Field>

        <p className="text-xs text-ink-faint">
          {parsed.length} guest{parsed.length === 1 ? "" : "s"} ready to import.
          Households and groups are created automatically if they don&rsquo;t
          exist yet.
        </p>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy || parsed.length === 0}>
          {busy ? "Importing…" : `Import ${parsed.length}`}
        </Button>
      </form>
    </Card>
  );
}
