import type { RsvpStatus, TableShape } from "@/generated/prisma/enums";
import { statusOf, type GuestLike } from "@/lib/domain/rsvp";

/**
 * Seating chart logic.
 *
 * The chart is derived from the guest list rather than kept alongside it: only
 * guests who have said yes (or maybe) can hold a seat, so an RSVP change is
 * always reflected in the plan.
 */

/** Guests who can hold a seat. A "maybe" is seatable but flagged in the UI. */
export const SEATABLE_STATUSES: RsvpStatus[] = ["ATTENDING", "MAYBE"];

export function isSeatable(guest: GuestLike): boolean {
  return SEATABLE_STATUSES.includes(statusOf(guest));
}

export type SeatingTableLike = {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  x: number;
  y: number;
};

export type AssignmentLike = {
  guestId: string;
  tableId: string;
};

export type TableOccupancy = {
  id: string;
  name: string;
  shape: TableShape;
  capacity: number;
  seated: number;
  seatsLeft: number;
  isFull: boolean;
  /** True when more guests are assigned than the table holds. */
  isOverCapacity: boolean;
  guestIds: string[];
};

export function occupancyFor(
  table: SeatingTableLike,
  assignments: AssignmentLike[],
): TableOccupancy {
  const guestIds = assignments
    .filter((assignment) => assignment.tableId === table.id)
    .map((assignment) => assignment.guestId);

  return {
    id: table.id,
    name: table.name,
    shape: table.shape,
    capacity: table.capacity,
    seated: guestIds.length,
    seatsLeft: Math.max(table.capacity - guestIds.length, 0),
    isFull: guestIds.length >= table.capacity,
    isOverCapacity: guestIds.length > table.capacity,
    guestIds,
  };
}

export type SeatingSummary = {
  tableCount: number;
  /** Total seats across every table. */
  totalCapacity: number;
  seated: number;
  /** Seatable guests with nowhere to sit yet. */
  unseated: number;
  /** Seats still free, floor-limited at zero. */
  seatsAvailable: number;
  /** True when there are more seatable guests than seats. */
  needsMoreSeats: boolean;
  overCapacityTables: string[];
  /** Guests who cannot be seated because they have not replied yet. */
  awaitingRsvp: number;
  tables: TableOccupancy[];
};

export function summarizeSeating(
  tables: SeatingTableLike[],
  assignments: AssignmentLike[],
  guests: GuestLike[],
): SeatingSummary {
  const seatable = guests.filter(isSeatable);
  const seatableIds = new Set(seatable.map((guest) => guest.id));

  // An assignment for a guest who has since declined does not count as seated;
  // the RSVP route clears those, this keeps the maths honest if one lingers.
  const live = assignments.filter((a) => seatableIds.has(a.guestId));
  const occupancies = tables.map((table) => occupancyFor(table, live));

  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
  const seated = live.length;

  return {
    tableCount: tables.length,
    totalCapacity,
    seated,
    unseated: seatable.length - seated,
    seatsAvailable: Math.max(totalCapacity - seated, 0),
    needsMoreSeats: seatable.length > totalCapacity,
    overCapacityTables: occupancies
      .filter((occupancy) => occupancy.isOverCapacity)
      .map((occupancy) => occupancy.id),
    awaitingRsvp: guests.filter((guest) => statusOf(guest) === "PENDING").length,
    tables: occupancies,
  };
}

/** Keeps a dragged table inside the canvas; positions are percentages. */
export function clampPosition(x: number, y: number): { x: number; y: number } {
  const clamp = (value: number) =>
    Number.isFinite(value) ? Math.min(100, Math.max(0, Number(value.toFixed(2)))) : 50;
  return { x: clamp(x), y: clamp(y) };
}

export const TABLE_SHAPE_LABELS: Record<TableShape, string> = {
  ROUND: "Round",
  RECTANGLE: "Long",
  HEAD: "Head table",
};

/**
 * A starting layout for a new chart: a head table plus enough round tables to
 * seat everyone, spread over the canvas so nothing overlaps on first render.
 */
export function suggestTables(
  seatableCount: number,
  { perTable = 8 }: { perTable?: number } = {},
): { name: string; shape: TableShape; capacity: number; x: number; y: number }[] {
  const roundTables = Math.max(
    0,
    Math.ceil(Math.max(seatableCount - perTable, 0) / perTable),
  );

  const tables: {
    name: string;
    shape: TableShape;
    capacity: number;
    x: number;
    y: number;
  }[] = [{ name: "Head table", shape: "HEAD", capacity: perTable, x: 50, y: 12 }];

  const perRow = 4;
  for (let index = 0; index < roundTables; index += 1) {
    const row = Math.floor(index / perRow);
    const column = index % perRow;
    const inThisRow = Math.min(perRow, roundTables - row * perRow);

    tables.push({
      name: `Table ${index + 1}`,
      shape: "ROUND",
      capacity: perTable,
      x: ((column + 0.5) / inThisRow) * 100,
      y: 35 + row * 22,
    });
  }

  return tables.map((table) => ({ ...table, ...clampPosition(table.x, table.y) }));
}
