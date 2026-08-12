"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorMessage,
  Field,
  Input,
  Select,
  Stat,
} from "@/components/ui";
import type { RsvpStatus, TableShape } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import {
  clampPosition,
  TABLE_SHAPE_LABELS,
  type SeatingSummary,
} from "@/lib/domain/seating";

type BoardTable = {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
};

type BoardGuest = {
  id: string;
  name: string;
  status: RsvpStatus;
  householdName: string | null;
  dietaryRestrictions: string | null;
};

type Assignment = { guestId: string; tableId: string };

/**
 * The floor plan.
 *
 * Tables are moved by dragging with pointer events, which covers mouse, touch
 * and pen with one code path. Seating a guest is tap-guest-then-tap-table
 * rather than a drag: HTML5 drag-and-drop is unreliable on touch, and most of
 * this planning happens on a phone.
 */
export function SeatingBoard({
  weddingId,
  canEdit,
  tables,
  assignments,
  guests,
  summary,
}: {
  weddingId: string;
  canEdit: boolean;
  tables: BoardTable[];
  assignments: Assignment[];
  guests: BoardGuest[];
  summary: SeatingSummary;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [openTableId, setOpenTableId] = useState<string | null>(null);
  const [addingTable, setAddingTable] = useState(false);
  /**
   * Optimistic positions while a table is being dragged and saved.
   *
   * `baseX`/`baseY` record where the server had the table when the drag began.
   * Once the server reports something different — our own save landing, or
   * another collaborator moving it — the override is stale and the server wins.
   * Deriving that during render avoids an effect that would fight the props.
   */
  const [dragged, setDragged] = useState<
    Record<string, { x: number; y: number; baseX: number; baseY: number }>
  >({});

  function positionOf(table: BoardTable) {
    const override = dragged[table.id];
    if (!override) return { x: table.x, y: table.y };
    const serverMoved =
      override.baseX !== table.x || override.baseY !== table.y;
    return serverMoved
      ? { x: table.x, y: table.y }
      : { x: override.x, y: override.y };
  }

  const canvasRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const guestsById = new Map(guests.map((guest) => [guest.id, guest]));
  const seatedIds = new Set(assignments.map((a) => a.guestId));
  const seatable = guests.filter((guest) =>
    guest.status === "ATTENDING" || guest.status === "MAYBE",
  );
  const unseated = seatable.filter((guest) => !seatedIds.has(guest.id));

  const guestsAtTable = (tableId: string) =>
    assignments
      .filter((assignment) => assignment.tableId === tableId)
      .map((assignment) => guestsById.get(assignment.guestId))
      .filter((guest): guest is BoardGuest => Boolean(guest));

  async function seat(guestId: string, tableId: string | null) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/seating/assignments`, {
        method: "PUT",
        body: { guestId, tableId },
      });
      setSelectedGuestId(null);
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function persistPosition(tableId: string, x: number, y: number) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/seating/tables/${tableId}`, {
        method: "PATCH",
        body: { x, y },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
      setDragged((current) => {
        const rest = { ...current };
        delete rest[tableId];
        return rest;
      });
    }
  }

  async function removeTable(tableId: string) {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/seating/tables/${tableId}`, {
        method: "DELETE",
      });
      setOpenTableId(null);
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  async function autoLayout() {
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/seating`, {
        method: "POST",
        body: { perTable: 8 },
      });
      refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  /** Converts a pointer position into canvas percentages. */
  function positionFromEvent(event: React.PointerEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return clampPosition(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  }

  /** Pointer travel, in pixels, before a press counts as a drag not a tap. */
  const DRAG_THRESHOLD = 5;

  function handlePointerDown(event: React.PointerEvent, table: BoardTable) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      id: table.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: table.x,
      baseY: table.y,
      moved: false,
    };
  }

  function handlePointerMove(event: React.PointerEvent) {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId || !canEdit) return;

    if (!state.moved) {
      const travelled = Math.hypot(
        event.clientX - state.startX,
        event.clientY - state.startY,
      );
      if (travelled < DRAG_THRESHOLD) return;
      state.moved = true;
    }

    const next = positionFromEvent(event);
    if (next) {
      setDragged((current) => ({
        ...current,
        [state.id]: { ...next, baseX: state.baseX, baseY: state.baseY },
      }));
    }
  }

  function handlePointerUp(event: React.PointerEvent, table: BoardTable) {
    const state = dragState.current;
    if (!state || state.pointerId !== event.pointerId) return;
    dragState.current = null;

    // A press that never travelled is a tap: seat the selected guest if there
    // is one, otherwise open the table.
    if (!state.moved) {
      if (selectedGuestId && canEdit) void seat(selectedGuestId, table.id);
      else setOpenTableId((current) => (current === table.id ? null : table.id));
      return;
    }

    const moved = dragged[table.id];
    if (moved) void persistPosition(table.id, moved.x, moved.y);
  }

  const openTable = tables.find((table) => table.id === openTableId) ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 p-5 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Seating chart</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {summary.seated} seated · {summary.unseated} to place ·{" "}
            {summary.seatsAvailable} seats free
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {tables.length === 0 && (
              <Button variant="secondary" onClick={autoLayout}>
                Suggest a layout
              </Button>
            )}
            <Button onClick={() => setAddingTable((open) => !open)}>
              {addingTable ? "Close" : "Add table"}
            </Button>
          </div>
        )}
      </header>

      <ErrorMessage>{error}</ErrorMessage>

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Tables" value={summary.tableCount} />
          <Stat label="Seats" value={summary.totalCapacity} />
          <Stat label="Seated" value={summary.seated} />
          <Stat
            label="To place"
            value={summary.unseated}
            hint={
              summary.awaitingRsvp > 0
                ? `${summary.awaitingRsvp} still to RSVP`
                : undefined
            }
          />
        </div>
        {summary.needsMoreSeats && (
          <p className="mt-4 rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert">
            You have more guests than seats. Add a table or raise a table&rsquo;s
            capacity.
          </p>
        )}
      </Card>

      {addingTable && canEdit && (
        <AddTableForm
          weddingId={weddingId}
          onDone={() => {
            setAddingTable(false);
            refresh();
          }}
        />
      )}

      {tables.length === 0 ? (
        <EmptyState
          title="No tables yet"
          description="Add tables one at a time, or let us suggest a layout sized to the guests who have accepted."
          action={
            canEdit ? (
              <Button onClick={autoLayout}>Suggest a layout</Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canEdit && (
            <p className="text-xs text-ink-faint">
              {selectedGuestId
                ? "Now tap a table to seat them."
                : "Drag tables to rearrange the room. Tap a guest, then a table, to seat them."}
            </p>
          )}

          <div
            ref={canvasRef}
            onPointerMove={handlePointerMove}
            className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl border border-line bg-surface-sunk sm:aspect-[16/9]"
          >
            <span className="pointer-events-none absolute inset-x-0 top-2 text-center text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Top of room
            </span>

            {tables.map((table) => {
              const position = positionOf(table);
              const seated = guestsAtTable(table.id);
              const isFull = seated.length >= table.capacity;
              const isOver = seated.length > table.capacity;
              const isOpen = openTableId === table.id;

              return (
                <button
                  key={table.id}
                  type="button"
                  onPointerDown={(event) => handlePointerDown(event, table)}
                  onPointerUp={(event) => handlePointerUp(event, table)}
                  aria-label={`${table.name}, ${seated.length} of ${table.capacity} seats taken`}
                  className={clsx(
                    "absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border-2 text-center transition-colors",
                    // Smaller on a phone. Positions are percentages, so on a
                    // ~350px canvas three tables across sit about 87px apart —
                    // and at the old 80px these overlapped into each other.
                    // They still clear the 44px touch minimum.
                    table.shape === "ROUND"
                      ? "h-14 w-14 rounded-full sm:h-24 sm:w-24"
                      : table.shape === "HEAD"
                        ? "h-12 w-24 rounded-xl sm:h-16 sm:w-44"
                        : "h-12 w-20 rounded-lg sm:h-20 sm:w-32",
                    isOver
                      ? "border-danger bg-danger-soft"
                      : isFull
                        ? "border-sage bg-sage-soft"
                        : "border-line-strong bg-surface",
                    isOpen && "ring-2 ring-clay ring-offset-2",
                    selectedGuestId && !isFull && "border-clay",
                    canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                  )}
                  style={{ left: `${position.x}%`, top: `${position.y}%` }}
                >
                  <span className="px-1 text-[10px] font-medium leading-tight text-ink sm:text-[11px]">
                    {table.name}
                  </span>
                  <span className="tabular text-[10px] text-ink-faint">
                    {seated.length}/{table.capacity}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {openTable && (
        <Card>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-lg text-ink">
              {openTable.name}{" "}
              <span className="text-sm font-normal text-ink-faint">
                {TABLE_SHAPE_LABELS[openTable.shape]} ·{" "}
                {guestsAtTable(openTable.id).length}/{openTable.capacity}
              </span>
            </h2>
            <div className="flex gap-2">
              {canEdit && (
                <Button
                  variant="danger"
                  className="px-3 py-1 text-xs"
                  onClick={() => removeTable(openTable.id)}
                >
                  Delete table
                </Button>
              )}
              <Button
                variant="ghost"
                className="px-3 py-1 text-xs"
                onClick={() => setOpenTableId(null)}
              >
                Close
              </Button>
            </div>
          </div>

          {guestsAtTable(openTable.id).length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              Nobody seated here yet.
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {guestsAtTable(openTable.id).map((guest) => (
                <li key={guest.id}>
                  <span className="inline-flex items-center gap-2 rounded-full bg-surface-sunk px-3 py-1 text-sm text-ink">
                    {guest.name}
                    {guest.status === "MAYBE" && <Badge tone="alert">maybe</Badge>}
                    {guest.dietaryRestrictions && (
                      <span
                        title={guest.dietaryRestrictions}
                        aria-label={`Dietary needs: ${guest.dietaryRestrictions}`}
                      >
                        🍽
                      </span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => seat(guest.id, null)}
                        aria-label={`Unseat ${guest.name}`}
                        className="text-ink-faint transition-colors hover:text-danger"
                      >
                        ×
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="font-display text-lg text-ink">
          Still to seat{" "}
          <span className="text-sm font-normal text-ink-faint">
            ({unseated.length})
          </span>
        </h2>

        {unseated.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">
            {seatable.length === 0
              ? "Nobody has accepted yet — the chart fills up as RSVPs come in."
              : "Everyone who has accepted has a seat. 🤍"}
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {unseated.map((guest) => {
              const selected = selectedGuestId === guest.id;
              return (
                <li key={guest.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={!canEdit}
                    onClick={() =>
                      setSelectedGuestId(selected ? null : guest.id)
                    }
                    className={clsx(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors",
                      selected
                        ? "bg-clay text-white"
                        : "bg-surface-sunk text-ink hover:bg-clay-soft",
                      !canEdit && "cursor-default",
                    )}
                  >
                    {guest.name}
                    {guest.status === "MAYBE" && (
                      <span className="text-[10px] uppercase opacity-70">
                        maybe
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {summary.awaitingRsvp > 0 && (
          <p className="mt-4 text-xs text-ink-faint">
            {summary.awaitingRsvp} guests have not replied yet. They appear here
            once they accept.
          </p>
        )}
      </Card>
    </main>
  );
}

function AddTableForm({
  weddingId,
  onDone,
}: {
  weddingId: string;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<TableShape>("ROUND");
  const [capacity, setCapacity] = useState("8");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/weddings/${weddingId}/seating/tables`, {
        method: "POST",
        body: {
          name,
          shape,
          capacity: Number(capacity) || 8,
          // New tables land in the middle; the couple drags them into place.
          x: 50,
          y: 50,
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
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Table name">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Table 7"
              required
              maxLength={60}
            />
          </Field>
          <Field label="Shape">
            <Select
              value={shape}
              onChange={(event) => setShape(event.target.value as TableShape)}
            >
              <option value="ROUND">Round</option>
              <option value="RECTANGLE">Long</option>
              <option value="HEAD">Head table</option>
            </Select>
          </Field>
          <Field label="Seats">
            <Input
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              inputMode="numeric"
            />
          </Field>
        </div>
        <ErrorMessage>{error}</ErrorMessage>
        <Button type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add table"}
        </Button>
      </form>
    </Card>
  );
}
