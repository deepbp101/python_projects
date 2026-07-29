"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui";
import type { Milestone, TaskPriority } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { daysBetween, formatDate, startOfUtcDay } from "@/lib/dates";
import {
  MILESTONE_LABELS,
  MILESTONE_ORDER,
  summarizeProgress,
  TASK_CATEGORIES,
} from "@/lib/domain/timeline";

export type ChecklistTask = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  milestone: Milestone;
  priority: TaskPriority;
  dueDate: string | null;
  completedAt: string | null;
  isCustom: boolean;
  assignedTo: { id: string; name: string | null; email: string } | null;
};

type Collaborator = { id: string; name: string | null; email: string };

type Filter = "all" | "open" | "overdue" | "done";

export function ChecklistBoard({
  weddingId,
  tasks,
  collaborators,
  canEdit,
}: {
  weddingId: string;
  tasks: ChecklistTask[];
  collaborators: Collaborator[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>("open");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Ticked boxes respond instantly; the refresh reconciles with the server.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  const progress = useMemo(() => summarizeProgress(tasks), [tasks]);

  const isDone = (task: ChecklistTask) =>
    optimistic[task.id] ?? task.completedAt !== null;

  const today = startOfUtcDay(new Date());
  const isOverdue = (task: ChecklistTask) =>
    !isDone(task) &&
    task.dueDate !== null &&
    daysBetween(today, new Date(task.dueDate)) < 0;

  const visible = tasks.filter((task) => {
    if (filter === "open") return !isDone(task);
    if (filter === "done") return isDone(task);
    if (filter === "overdue") return isOverdue(task);
    return true;
  });

  const grouped = MILESTONE_ORDER.map((milestone) => ({
    milestone,
    tasks: visible.filter((task) => task.milestone === milestone),
  })).filter((group) => group.tasks.length > 0);

  async function toggle(task: ChecklistTask) {
    const next = !isDone(task);
    setOptimistic((current) => ({ ...current, [task.id]: next }));
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/tasks/${task.id}`, {
        method: "PATCH",
        body: { completed: next },
      });
      startTransition(() => router.refresh());
    } catch (caught) {
      // Roll the checkbox back to whatever the server last told us.
      setOptimistic((current) => {
        const rest = { ...current };
        delete rest[task.id];
        return rest;
      });
      setError(errorMessage(caught));
    }
  }

  async function remove(task: ChecklistTask) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/tasks/${task.id}`, {
        method: "DELETE",
      });
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function regenerate() {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/tasks/generate`, {
        method: "POST",
        body: { replaceExisting: false },
      });
      startTransition(() => router.refresh());
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Checklist</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {progress.completed} of {progress.total} done
            {progress.overdue > 0 && ` · ${progress.overdue} overdue`}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={regenerate} disabled={pending}>
              Refresh timeline
            </Button>
            <Button onClick={() => setAdding((open) => !open)}>
              {adding ? "Close" : "Add task"}
            </Button>
          </div>
        )}
      </header>

      <ProgressBar
        value={progress.percentComplete}
        tone="sage"
        label="Checklist progress"
      />

      <ErrorMessage>{error}</ErrorMessage>

      {adding && canEdit && (
        <AddTaskForm
          weddingId={weddingId}
          collaborators={collaborators}
          onDone={() => {
            setAdding(false);
            startTransition(() => router.refresh());
          }}
        />
      )}

      <div className="flex flex-wrap gap-2">
        {(["open", "overdue", "done", "all"] as Filter[]).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={clsx(
              "rounded-full px-3 py-1 text-sm capitalize transition-colors",
              filter === option
                ? "bg-ink text-canvas"
                : "bg-surface text-ink-soft hover:bg-surface-sunk",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          title="Nothing here"
          description={
            filter === "open"
              ? "Every task is ticked off. Enjoy the moment."
              : "No tasks match this filter."
          }
        />
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.milestone}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
                {MILESTONE_LABELS[group.milestone]}
              </h2>
              <ul className="space-y-2">
                {group.tasks.map((task) => (
                  <li key={task.id}>
                    <Card className="p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isDone(task)}
                          onChange={() => toggle(task)}
                          disabled={!canEdit}
                          aria-label={`Mark "${task.title}" ${isDone(task) ? "not done" : "done"}`}
                          className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-sage)]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span
                              className={clsx(
                                "font-medium",
                                isDone(task)
                                  ? "text-ink-faint line-through"
                                  : "text-ink",
                              )}
                            >
                              {task.title}
                            </span>
                            {task.priority === "HIGH" && !isDone(task) && (
                              <Badge tone="rose">Priority</Badge>
                            )}
                            {isOverdue(task) && <Badge tone="danger">Overdue</Badge>}
                          </div>

                          {task.description && (
                            <p className="mt-1 text-sm text-ink-soft">
                              {task.description}
                            </p>
                          )}

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
                            <span>{task.category}</span>
                            <span>Due {formatDate(task.dueDate)}</span>
                            {task.assignedTo && (
                              <span>
                                {task.assignedTo.name ?? task.assignedTo.email}
                              </span>
                            )}
                          </div>
                        </div>

                        {canEdit && (
                          <button
                            onClick={() => remove(task)}
                            aria-label={`Delete "${task.title}"`}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function AddTaskForm({
  weddingId,
  collaborators,
  onDone,
}: {
  weddingId: string;
  collaborators: Collaborator[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(TASK_CATEGORIES[0]);
  const [milestone, setMilestone] = useState<Milestone>("THREE_MONTHS");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/tasks`, {
        method: "POST",
        body: {
          title,
          description: description || null,
          category,
          milestone,
          priority,
          dueDate: dueDate || null,
          assignedToId: assignedToId || null,
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
        <Field label="Task">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Confirm the cake tasting"
            required
            maxLength={200}
          />
        </Field>

        <Field label="Notes (optional)">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <Select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {TASK_CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Timeline">
            <Select
              value={milestone}
              onChange={(event) =>
                setMilestone(event.target.value as Milestone)
              }
            >
              {MILESTONE_ORDER.map((option) => (
                <option key={option} value={option}>
                  {MILESTONE_LABELS[option]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Due date">
            <Input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>

          <Field label="Priority">
            <Select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as TaskPriority)
              }
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </Select>
          </Field>
        </div>

        <Field label="Assign to (optional)">
          <Select
            value={assignedToId}
            onChange={(event) => setAssignedToId(event.target.value)}
          >
            <option value="">Nobody yet</option>
            {collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.name ?? collaborator.email}
              </option>
            ))}
          </Select>
        </Field>

        <ErrorMessage>{error}</ErrorMessage>

        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add task"}
        </Button>
      </form>
    </Card>
  );
}
