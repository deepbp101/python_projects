"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  ErrorMessage,
  Field,
  Input,
  Select,
} from "@/components/ui";
import type {
  AccessLevel,
  CollaboratorRole,
  CollaboratorStatus,
  WorkspaceSection,
} from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatMoney, parseMoney } from "@/lib/money";
import {
  ROLE_LABELS,
  SECTION_LABELS,
  WORKSPACE_SECTIONS,
} from "@/lib/permissions";

type BoardCollaborator = {
  id: string;
  email: string;
  name: string | null;
  role: CollaboratorRole;
  status: CollaboratorStatus;
  access: Record<WorkspaceSection, AccessLevel>;
};

export function WeddingSettings({
  weddingId,
  isOwner,
  wedding,
  collaborators,
}: {
  weddingId: string;
  isOwner: boolean;
  wedding: {
    title: string;
    weddingDate: string;
    venueName: string | null;
    location: string | null;
    totalBudget: number;
    currency: string;
  };
  collaborators: BoardCollaborator[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="space-y-5">
      <DetailsForm
        weddingId={weddingId}
        isOwner={isOwner}
        wedding={wedding}
        onSaved={refresh}
      />
      <CollaboratorList
        weddingId={weddingId}
        isOwner={isOwner}
        collaborators={collaborators}
        onChanged={refresh}
      />
    </div>
  );
}

function DetailsForm({
  weddingId,
  isOwner,
  wedding,
  onSaved,
}: {
  weddingId: string;
  isOwner: boolean;
  wedding: {
    title: string;
    weddingDate: string;
    venueName: string | null;
    location: string | null;
    totalBudget: number;
    currency: string;
  };
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(wedding.title);
  const [weddingDate, setWeddingDate] = useState(wedding.weddingDate);
  const [venueName, setVenueName] = useState(wedding.venueName ?? "");
  const [location, setLocation] = useState(wedding.location ?? "");
  const [budget, setBudget] = useState(
    (wedding.totalBudget / 100).toFixed(2).replace(/\.00$/, ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const dateChanged = weddingDate !== wedding.weddingDate;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const totalBudget = parseMoney(budget);
    if (totalBudget === null) {
      setError("That budget doesn't look like a number.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiFetch(`/api/weddings/${weddingId}`, {
        method: "PATCH",
        body: {
          title,
          weddingDate,
          venueName: venueName || null,
          location: location || null,
          totalBudget,
        },
      });
      setSaved(true);
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle>Wedding details</CardTitle>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Title">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!isOwner}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Wedding date"
            hint={
              dateChanged
                ? "Existing task due dates stay as they are — use “Refresh timeline” on the checklist to add anything missing."
                : undefined
            }
          >
            <Input
              type="date"
              value={weddingDate}
              onChange={(event) => setWeddingDate(event.target.value)}
              disabled={!isOwner}
              required
            />
          </Field>
          <Field label={`Total budget (${wedding.currency})`}>
            <Input
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              disabled={!isOwner}
              inputMode="decimal"
            />
          </Field>
          <Field label="Venue">
            <Input
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              disabled={!isOwner}
            />
          </Field>
          <Field label="Location">
            <Input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              disabled={!isOwner}
            />
          </Field>
        </div>

        <ErrorMessage>{error}</ErrorMessage>
        {saved && !error && (
          <p className="text-sm text-sage">Saved.</p>
        )}

        {isOwner && (
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        )}
      </form>
      {!isOwner && (
        <p className="mt-3 text-xs text-ink-faint">
          Current budget: {formatMoney(wedding.totalBudget, wedding.currency)}
        </p>
      )}
    </Card>
  );
}

function CollaboratorList({
  weddingId,
  isOwner,
  collaborators,
  onChanged,
}: {
  weddingId: string;
  isOwner: boolean;
  collaborators: BoardCollaborator[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  async function updateAccess(
    collaborator: BoardCollaborator,
    section: WorkspaceSection,
    access: AccessLevel,
  ) {
    setError(null);
    const permissions = WORKSPACE_SECTIONS.map((entry) => ({
      section: entry,
      access: entry === section ? access : collaborator.access[entry],
    }));
    try {
      await apiFetch(
        `/api/weddings/${weddingId}/collaborators/${collaborator.id}`,
        { method: "PATCH", body: { permissions } },
      );
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function remove(collaboratorId: string) {
    setError(null);
    try {
      await apiFetch(
        `/api/weddings/${weddingId}/collaborators/${collaboratorId}`,
        { method: "DELETE" },
      );
      onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Card>
      <CardTitle>Who&rsquo;s helping</CardTitle>

      <ErrorMessage>{error}</ErrorMessage>

      <ul className="space-y-3">
        {collaborators.map((collaborator) => (
          <li
            key={collaborator.id}
            className="rounded-xl border border-line p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">
                  {collaborator.name ?? collaborator.email}
                </p>
                <p className="text-xs text-ink-faint">{collaborator.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={collaborator.role === "OWNER" ? "clay" : "neutral"}>
                  {ROLE_LABELS[collaborator.role]}
                </Badge>
                {collaborator.status === "INVITED" && (
                  <Badge tone="alert">Invited</Badge>
                )}
                {isOwner && collaborator.role !== "OWNER" && (
                  <>
                    <button
                      onClick={() =>
                        setEditing((current) =>
                          current === collaborator.id ? null : collaborator.id,
                        )
                      }
                      className="text-xs text-clay-dark underline underline-offset-2"
                    >
                      {editing === collaborator.id ? "Done" : "Access"}
                    </button>
                    <button
                      onClick={() => remove(collaborator.id)}
                      className="rounded-lg px-2 py-0.5 text-xs text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>

            {editing === collaborator.id && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {WORKSPACE_SECTIONS.map((section) => (
                  <label
                    key={section}
                    className="flex items-center justify-between gap-2 text-xs text-ink-soft"
                  >
                    {SECTION_LABELS[section]}
                    <Select
                      value={collaborator.access[section]}
                      onChange={(event) =>
                        updateAccess(
                          collaborator,
                          section,
                          event.target.value as AccessLevel,
                        )
                      }
                      className="w-28 py-1 text-xs"
                    >
                      <option value="NONE">Hidden</option>
                      <option value="VIEW">Can view</option>
                      <option value="EDIT">Can edit</option>
                    </Select>
                  </label>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div className="mt-5 border-t border-line pt-5">
          <InviteForm
            weddingId={weddingId}
            onInvited={(url) => {
              setInviteUrl(url);
              onChanged();
            }}
          />
          {inviteUrl && (
            <div className="mt-3 rounded-xl bg-surface-sunk p-3">
              <p className="text-xs text-ink-soft">
                Send them this link — it works once and expires in 14 days.
              </p>
              <code className="mt-1 block break-all text-xs text-ink">
                {inviteUrl}
              </code>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function InviteForm({
  weddingId,
  onInvited,
}: {
  weddingId: string;
  onInvited: (url: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"PARTNER" | "PLANNER" | "FAMILY">("FAMILY");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiFetch<{ inviteUrl: string }>(
        `/api/weddings/${weddingId}/collaborators`,
        { method: "POST", body: { email, role } },
      );
      setEmail("");
      onInvited(result.inviteUrl);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Invite someone">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="planner@example.com"
            required
          />
        </Field>
        <Field label="As">
          <Select
            value={role}
            onChange={(event) =>
              setRole(event.target.value as "PARTNER" | "PLANNER" | "FAMILY")
            }
          >
            <option value="PARTNER">Partner</option>
            <option value="PLANNER">Planner</option>
            <option value="FAMILY">Family & friends</option>
          </Select>
        </Field>
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Invite"}
        </Button>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
    </form>
  );
}
