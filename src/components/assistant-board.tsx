"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui";
import type { AiDraftKind } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { formatDate } from "@/lib/dates";
import {
  DRAFT_KIND_HINTS,
  DRAFT_KIND_LABELS,
  DRAFT_KINDS,
  DRAFT_LENGTH_LABELS,
  DRAFT_LENGTHS,
  DRAFT_TONE_LABELS,
  DRAFT_TONES,
  type DraftLength,
  type DraftTone,
} from "@/lib/ai/prompts";
import {
  STYLE_QUIZ,
  THEME_PROFILES,
  type ScoredTheme,
} from "@/lib/domain/style";
import { VENDOR_CATEGORY_LABELS } from "@/lib/domain/vendors";

export type DraftView = {
  id: string;
  kind: AiDraftKind;
  title: string;
  prompt: string;
  content: string;
  model: string;
  createdAt: string;
};

export type StyleProfileView = {
  answers: Record<string, string>;
  themes: ScoredTheme[];
  summary: string | null;
  updatedAt: string;
} | null;

/**
 * The two assistants.
 *
 * The writing side needs a model and says so plainly when there isn't one. The
 * style side does not: its matching is scored in the domain layer, so it works
 * either way and only the summary paragraph goes missing.
 */
export function AssistantBoard({
  weddingId,
  aiConfigured,
  canWrite,
  canStyle,
  drafts,
  profile,
}: {
  weddingId: string;
  aiConfigured: boolean;
  /** Writing is couple-only — vows and speeches are not shared workspace data. */
  canWrite: boolean;
  canStyle: boolean;
  drafts: DraftView[];
  profile: StyleProfileView;
}) {
  const [tab, setTab] = useState<"writing" | "style">(
    canWrite ? "writing" : "style",
  );

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-5 sm:p-8">
      <header>
        <h1 className="font-display text-2xl text-ink">Assistant</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Help with the writing, and a read on the style you keep circling.
        </p>
      </header>

      {!aiConfigured && (
        <Card className="border-alert/40 bg-alert-soft">
          <p className="text-sm text-ink">
            No Anthropic API key is set, so the writing assistant is off. Set{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-xs">
              ANTHROPIC_API_KEY
            </code>{" "}
            and restart to switch it on. The style quiz below works without it.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["writing", "Writing"],
            ["style", "Style"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={clsx(
              "rounded-full px-3 py-1 text-sm transition-colors",
              tab === value
                ? "bg-ink text-canvas"
                : "bg-surface text-ink-soft hover:bg-surface-sunk",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "writing" ? (
        canWrite ? (
          <WritingAssistant
            weddingId={weddingId}
            aiConfigured={aiConfigured}
            drafts={drafts}
          />
        ) : (
          <Card>
            <p className="text-sm text-ink-soft">
              The writing assistant is limited to the couple — vows and speeches
              aren&rsquo;t shared with the rest of the workspace.
            </p>
          </Card>
        )
      ) : (
        <StyleMatchmaker
          weddingId={weddingId}
          canStyle={canStyle}
          profile={profile}
        />
      )}
    </main>
  );
}

function WritingAssistant({
  weddingId,
  aiConfigured,
  drafts,
}: {
  weddingId: string;
  aiConfigured: boolean;
  drafts: DraftView[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  const [kind, setKind] = useState<AiDraftKind>("VOWS");
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<DraftTone>("WARM");
  const [length, setLength] = useState<DraftLength>("MEDIUM");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/ai/drafts`, {
        method: "POST",
        body: { kind, brief, tone, length, title: title || null },
      });
      setBrief("");
      setTitle("");
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(draftId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/ai/drafts/${draftId}`, {
        method: "DELETE",
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Write something</CardTitle>
        <form onSubmit={generate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="What is it?">
              <Select
                value={kind}
                onChange={(event) => setKind(event.target.value as AiDraftKind)}
              >
                {DRAFT_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {DRAFT_KIND_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tone">
              <Select
                value={tone}
                onChange={(event) => setTone(event.target.value as DraftTone)}
              >
                {DRAFT_TONES.map((option) => (
                  <option key={option} value={option}>
                    {DRAFT_TONE_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Length">
              <Select
                value={length}
                onChange={(event) => setLength(event.target.value as DraftLength)}
              >
                {DRAFT_LENGTHS.map((option) => (
                  <option key={option} value={option}>
                    {DRAFT_LENGTH_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Tell it what to work with"
            hint={DRAFT_KIND_HINTS[kind]}
          >
            <Textarea
              required
              rows={4}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="The more specific you are, the less generic it comes back."
            />
          </Field>

          <Field label="Save it as (optional)">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={DRAFT_KIND_LABELS[kind]}
            />
          </Field>

          <ErrorMessage>{error}</ErrorMessage>

          <Button
            type="submit"
            disabled={busy || !aiConfigured || brief.trim() === ""}
          >
            {busy ? "Writing…" : "Write a draft"}
          </Button>
          <p className="text-xs text-ink-faint">
            It only knows your names, date, venue and style — it will leave
            [brackets] where it needs a detail rather than inventing one.
          </p>
        </form>
      </Card>

      {drafts.length === 0 ? (
        <EmptyState
          title="No drafts yet"
          description="Anything you generate is saved here with the brief you gave, so you can come back and rework it."
        />
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <DraftCard draft={draft} onDelete={() => remove(draft.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  onDelete,
}: {
  draft: DraftView;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-display text-base text-ink">{draft.title}</span>
        <Badge tone="clay">{DRAFT_KIND_LABELS[draft.kind]}</Badge>
        <span className="ml-auto text-xs text-ink-faint">
          {formatDate(draft.createdAt)} · {draft.model}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
        {draft.content}
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-ink-faint">
          What you asked for
        </summary>
        <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">
          {draft.prompt}
        </p>
      </details>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1 text-xs"
          onClick={() => {
            void navigator.clipboard.writeText(draft.content);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function StyleMatchmaker({
  weddingId,
  canStyle,
  profile,
}: {
  weddingId: string;
  canStyle: boolean;
  profile: StyleProfileView;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [answers, setAnswers] = useState<Record<string, string>>(
    profile?.answers ?? {},
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const answered = STYLE_QUIZ.filter(
    (question) => answers[question.id] !== undefined,
  ).length;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/style`, {
        method: "PUT",
        body: { answers },
      });
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const leaders = (profile?.themes ?? []).filter((entry) => entry.score > 0).slice(0, 2);

  return (
    <div className="space-y-5">
      {leaders.length > 0 && (
        <Card>
          <CardTitle
            action={
              profile && (
                <span className="text-xs text-ink-faint">
                  Updated {formatDate(profile.updatedAt)}
                </span>
              )
            }
          >
            Your style
          </CardTitle>

          {profile?.summary && (
            <p className="mb-4 text-sm leading-relaxed text-ink">
              {profile.summary}
            </p>
          )}

          <div className="space-y-5">
            {leaders.map((entry) => {
              const theme = THEME_PROFILES[entry.theme];
              return (
                <div key={entry.theme}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-base text-ink">
                      {theme.label}
                    </span>
                    <span className="tabular text-xs text-ink-soft">
                      {entry.score}%
                    </span>
                  </div>
                  <ProgressBar
                    value={entry.score}
                    tone="clay"
                    label={`${theme.label} match`}
                  />
                  <p className="mt-2 text-sm text-ink-soft">{theme.blurb}</p>

                  <div className="mt-3 flex gap-1.5">
                    {theme.palette.map((hex) => (
                      <span
                        key={hex}
                        title={hex}
                        className="h-8 w-8 rounded-full border border-line"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>

                  <ul className="mt-3 space-y-1">
                    {theme.decor.map((item) => (
                      <li key={item} className="text-sm text-ink-soft">
                        · {item}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {theme.priorities.map((category) => (
                      <Link
                        key={category}
                        href={`/w/${weddingId}/vendors`}
                        className="rounded-full bg-clay-soft px-3 py-1 text-xs text-clay-dark transition-colors hover:bg-clay-soft/70"
                      >
                        Find {VENDOR_CATEGORY_LABELS[category].toLowerCase()}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle
          action={
            <span className="text-xs text-ink-soft">
              {answered} of {STYLE_QUIZ.length}
            </span>
          }
        >
          {leaders.length > 0 ? "Take it again" : "Style quiz"}
        </CardTitle>

        <div className="space-y-6">
          {STYLE_QUIZ.map((question) => (
            <fieldset key={question.id}>
              <legend className="mb-2 text-sm font-medium text-ink">
                {question.prompt}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const checked = answers[question.id] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={clsx(
                        "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                        checked
                          ? "border-clay bg-clay-soft text-clay-dark"
                          : "border-line bg-surface text-ink-soft hover:bg-surface-sunk",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={checked}
                        disabled={!canStyle}
                        onChange={() =>
                          setAnswers({ ...answers, [question.id]: option.id })
                        }
                        className="h-4 w-4 border-line-strong text-clay focus:ring-clay/30"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        {canStyle && (
          <Button
            className="mt-5"
            disabled={busy || answered === 0}
            onClick={submit}
          >
            {busy ? "Working…" : "See what it says"}
          </Button>
        )}
        <p className="mt-2 text-xs text-ink-faint">
          Your mood board counts too — what you have pinned nudges the result.
        </p>
      </Card>
    </div>
  );
}
