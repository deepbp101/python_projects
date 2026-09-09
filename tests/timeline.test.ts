import { describe, expect, it } from "vitest";
import { daysBetween, startOfUtcDay } from "@/lib/dates";
import {
  DEFAULT_TASK_CATALOG,
  generateTimeline,
  milestoneForOffset,
  summarizeProgress,
  type TaskTemplate,
} from "@/lib/domain/timeline";

const WEDDING = new Date("2027-06-12T00:00:00.000Z");
/** A year and a bit before the wedding, so nothing is compressed by default. */
const EARLY = new Date("2026-05-01T00:00:00.000Z");

const template = (
  key: string,
  offsetDays: number,
  overrides: Partial<TaskTemplate> = {},
): TaskTemplate => ({
  key,
  title: key,
  description: "",
  category: "Planning",
  offsetDays,
  priority: "MEDIUM",
  ...overrides,
});

describe("milestoneForOffset", () => {
  it("maps each offset to the phase it belongs to", () => {
    expect(milestoneForOffset(400)).toBe("TWELVE_MONTHS");
    expect(milestoneForOffset(271)).toBe("TWELVE_MONTHS");
    expect(milestoneForOffset(270)).toBe("NINE_MONTHS");
    expect(milestoneForOffset(181)).toBe("NINE_MONTHS");
    expect(milestoneForOffset(180)).toBe("SIX_MONTHS");
    expect(milestoneForOffset(91)).toBe("SIX_MONTHS");
    expect(milestoneForOffset(90)).toBe("THREE_MONTHS");
    expect(milestoneForOffset(31)).toBe("THREE_MONTHS");
    expect(milestoneForOffset(30)).toBe("ONE_MONTH");
    expect(milestoneForOffset(8)).toBe("ONE_MONTH");
    expect(milestoneForOffset(7)).toBe("ONE_WEEK");
    expect(milestoneForOffset(1)).toBe("ONE_WEEK");
    expect(milestoneForOffset(0)).toBe("DAY_OF");
    expect(milestoneForOffset(-1)).toBe("AFTER");
  });
});

describe("generateTimeline", () => {
  it("creates one task per catalog entry", () => {
    const tasks = generateTimeline(WEDDING, { now: EARLY });
    expect(tasks).toHaveLength(DEFAULT_TASK_CATALOG.length);
    expect(new Set(tasks.map((task) => task.templateKey)).size).toBe(
      DEFAULT_TASK_CATALOG.length,
    );
  });

  it("places due dates the right number of days before the wedding", () => {
    const catalog = [template("a", 365), template("b", 30), template("c", 0)];
    const tasks = generateTimeline(WEDDING, { now: EARLY, catalog });

    const byKey = Object.fromEntries(
      tasks.map((task) => [task.templateKey, task]),
    );
    expect(daysBetween(byKey.a.dueDate, WEDDING)).toBe(365);
    expect(daysBetween(byKey.b.dueDate, WEDDING)).toBe(30);
    expect(byKey.c.dueDate.getTime()).toBe(WEDDING.getTime());
  });

  it("schedules after-the-wedding tasks after the wedding", () => {
    const catalog = [template("thanks", -14)];
    const [task] = generateTimeline(WEDDING, { now: EARLY, catalog });

    expect(task.milestone).toBe("AFTER");
    expect(daysBetween(WEDDING, task.dueDate)).toBe(14);
  });

  it("returns tasks in due-date order with sequential sortOrder", () => {
    const tasks = generateTimeline(WEDDING, { now: EARLY });

    for (let i = 1; i < tasks.length; i += 1) {
      expect(tasks[i].dueDate.getTime()).toBeGreaterThanOrEqual(
        tasks[i - 1].dueDate.getTime(),
      );
    }
    expect(tasks.map((task) => task.sortOrder)).toEqual(
      tasks.map((_task, index) => index),
    );
  });

  it("skips catalog entries the wedding already has", () => {
    const existingKeys = DEFAULT_TASK_CATALOG.slice(0, 5).map((t) => t.key);
    const tasks = generateTimeline(WEDDING, { now: EARLY, existingKeys });

    expect(tasks).toHaveLength(DEFAULT_TASK_CATALOG.length - 5);
    for (const key of existingKeys) {
      expect(tasks.some((task) => task.templateKey === key)).toBe(false);
    }
  });

  it("pulls past-due tasks forward to today for a short engagement", () => {
    // Two months out: everything from 12/9/6 months ago is already unreachable.
    const now = new Date("2027-04-12T00:00:00.000Z");
    const tasks = generateTimeline(WEDDING, { now });
    const today = startOfUtcDay(now);

    const compressed = tasks.filter((task) => task.wasCompressed);
    expect(compressed.length).toBeGreaterThan(0);

    for (const task of compressed) {
      expect(task.dueDate.getTime()).toBe(today.getTime());
    }
    // Nothing is created already overdue.
    for (const task of tasks) {
      expect(task.dueDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
    }
  });

  it("keeps the original milestone when a task is pulled forward", () => {
    const now = new Date("2027-04-12T00:00:00.000Z");
    const catalog = [template("book-venue", 330)];
    const [task] = generateTimeline(WEDDING, { now, catalog });

    expect(task.wasCompressed).toBe(true);
    expect(task.milestone).toBe("TWELVE_MONTHS");
  });

  it("is deterministic for the same inputs", () => {
    const first = generateTimeline(WEDDING, { now: EARLY });
    const second = generateTimeline(WEDDING, { now: EARLY });
    expect(first).toEqual(second);
  });

  it("uses unique template keys across the default catalog", () => {
    const keys = DEFAULT_TASK_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("summarizeProgress", () => {
  const now = new Date("2026-05-01T12:00:00.000Z");

  it("counts completion, overdue and due-this-week separately", () => {
    const progress = summarizeProgress(
      [
        { completedAt: new Date("2026-04-01"), dueDate: new Date("2026-04-01") },
        { completedAt: null, dueDate: new Date("2026-04-20") }, // overdue
        { completedAt: null, dueDate: new Date("2026-05-04") }, // this week
        { completedAt: null, dueDate: new Date("2026-05-08") }, // this week
        { completedAt: null, dueDate: new Date("2026-09-01") }, // later
      ],
      now,
    );

    expect(progress.total).toBe(5);
    expect(progress.completed).toBe(1);
    expect(progress.percentComplete).toBe(20);
    expect(progress.overdue).toBe(1);
    expect(progress.dueThisWeek).toBe(2);
  });

  it("never counts a completed task as overdue", () => {
    const progress = summarizeProgress(
      [{ completedAt: new Date("2026-04-30"), dueDate: new Date("2026-01-01") }],
      now,
    );
    expect(progress.overdue).toBe(0);
    expect(progress.percentComplete).toBe(100);
  });

  it("handles an empty checklist without dividing by zero", () => {
    const progress = summarizeProgress([], now);
    expect(progress).toEqual({
      total: 0,
      completed: 0,
      percentComplete: 0,
      overdue: 0,
      dueThisWeek: 0,
    });
  });

  it("ignores tasks with no due date when counting overdue", () => {
    const progress = summarizeProgress(
      [{ completedAt: null, dueDate: null }],
      now,
    );
    expect(progress.overdue).toBe(0);
    expect(progress.dueThisWeek).toBe(0);
  });
});
