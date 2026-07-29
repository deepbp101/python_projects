import { describe, expect, it } from "vitest";
import { countdownTo, daysBetween, startOfUtcDay } from "@/lib/dates";
import { formatMoney, parseMoney, percentOf } from "@/lib/money";

describe("parseMoney", () => {
  it("accepts the ways people actually type amounts", () => {
    expect(parseMoney("12500")).toBe(1_250_000);
    expect(parseMoney("12,500")).toBe(1_250_000);
    expect(parseMoney("$12,500.50")).toBe(1_250_050);
    expect(parseMoney(" 42 ")).toBe(4_200);
    expect(parseMoney(125.5)).toBe(12_550);
  });

  it("rounds to whole cents rather than storing a float", () => {
    expect(parseMoney("0.1")).toBe(10);
    expect(parseMoney("19.999")).toBe(2_000);
  });

  it("returns null for anything that is not an amount", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("12.34.56")).toBeNull();
    expect(parseMoney(Number.NaN)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("hides cents on round amounts and shows them otherwise", () => {
    expect(formatMoney(1_250_000)).toBe("$12,500");
    expect(formatMoney(1_250_050)).toBe("$12,500.50");
    expect(formatMoney(0)).toBe("$0");
  });

  it("formats negative amounts, which is what over-budget looks like", () => {
    expect(formatMoney(-30_000)).toBe("-$300");
  });
});

describe("percentOf", () => {
  it("rounds to a whole percent", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
  });

  it("avoids dividing by zero", () => {
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(50, 0)).toBe(100);
  });
});

describe("date helpers", () => {
  it("counts whole calendar days in UTC", () => {
    expect(
      daysBetween(new Date("2026-06-01"), new Date("2026-06-08")),
    ).toBe(7);
    expect(
      daysBetween(new Date("2026-06-08"), new Date("2026-06-01")),
    ).toBe(-7);
  });

  it("ignores the time of day when comparing days", () => {
    expect(
      daysBetween(
        new Date("2026-06-01T23:59:00.000Z"),
        new Date("2026-06-02T00:01:00.000Z"),
      ),
    ).toBe(1);
  });

  it("does not shift days across a DST boundary", () => {
    // US DST starts 8 March 2026; naive local-time arithmetic loses an hour here.
    const before = startOfUtcDay(new Date("2026-03-07T12:00:00.000Z"));
    const after = startOfUtcDay(new Date("2026-03-09T12:00:00.000Z"));
    expect(daysBetween(before, after)).toBe(2);
  });
});

describe("countdownTo", () => {
  const now = new Date("2026-06-01T00:00:00.000Z");

  it("breaks the remaining time into days, hours, minutes and seconds", () => {
    const countdown = countdownTo(
      new Date("2026-06-03T05:30:15.000Z"),
      now,
    );

    expect(countdown).toMatchObject({
      days: 2,
      hours: 5,
      minutes: 30,
      seconds: 15,
      hasPassed: false,
    });
  });

  it("clamps to zero and flags a wedding that has already happened", () => {
    const countdown = countdownTo(new Date("2026-05-01T00:00:00.000Z"), now);

    expect(countdown.hasPassed).toBe(true);
    expect(countdown.days).toBe(0);
    expect(countdown.hours).toBe(0);
    expect(countdown.totalMs).toBeLessThan(0);
  });

  it("treats the exact moment of the wedding as passed", () => {
    expect(countdownTo(now, now).hasPassed).toBe(true);
  });
});
