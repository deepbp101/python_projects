import { describe, expect, it } from "vitest";
import {
  callerAddress,
  decide,
  retryAfterFor,
  windowStartFor,
  type WindowSpec,
} from "@/lib/domain/limits";

const MINUTE: WindowSpec = { seconds: 60, limit: 5 };

describe("windowStartFor", () => {
  it("snaps to the epoch grid, not to first contact", () => {
    expect(windowStartFor(60, new Date("2026-07-30T12:34:56Z")).toISOString()).toBe(
      "2026-07-30T12:34:00.000Z",
    );
    expect(windowStartFor(3600, new Date("2026-07-30T12:34:56Z")).toISOString()).toBe(
      "2026-07-30T12:00:00.000Z",
    );
    expect(
      windowStartFor(86_400, new Date("2026-07-30T12:34:56Z")).toISOString(),
    ).toBe("2026-07-30T00:00:00.000Z");
  });

  it("puts two moments in the same window onto the same key", () => {
    const a = windowStartFor(60, new Date("2026-07-30T12:34:00Z"));
    const b = windowStartFor(60, new Date("2026-07-30T12:34:59.999Z"));
    expect(a.getTime()).toBe(b.getTime());
  });

  it("rolls over the instant the window ends", () => {
    const a = windowStartFor(60, new Date("2026-07-30T12:34:59.999Z"));
    const b = windowStartFor(60, new Date("2026-07-30T12:35:00Z"));
    expect(b.getTime() - a.getTime()).toBe(60_000);
  });
});

describe("decide", () => {
  it("allows exactly the limit and no more", () => {
    expect(decide(MINUTE, 5).allowed).toBe(true);
    expect(decide(MINUTE, 6).allowed).toBe(false);
  });

  it("keeps counting past the limit, so retrying does not reset it", () => {
    expect(decide(MINUTE, 500)).toEqual({ allowed: false, remaining: 0 });
  });

  it("reports what is left", () => {
    expect(decide(MINUTE, 1).remaining).toBe(4);
    expect(decide(MINUTE, 5).remaining).toBe(0);
  });

  it("refuses everything when the limit is zero", () => {
    expect(decide({ seconds: 60, limit: 0 }, 1).allowed).toBe(false);
  });
});

describe("retryAfterFor", () => {
  it("counts the seconds left in the window", () => {
    expect(retryAfterFor(MINUTE, new Date("2026-07-30T12:34:00Z"))).toBe(60);
    expect(retryAfterFor(MINUTE, new Date("2026-07-30T12:34:30Z"))).toBe(30);
  });

  it("never says zero — a client told to wait zero comes straight back", () => {
    expect(
      retryAfterFor(MINUTE, new Date("2026-07-30T12:34:59.999Z")),
    ).toBeGreaterThanOrEqual(1);
  });
});

const headers = (init: Record<string, string>) => new Headers(init);

describe("callerAddress", () => {
  it("prefers the forwarded client over the proxy", () => {
    expect(
      callerAddress(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })),
    ).toBe("203.0.113.7");
  });

  it("trims the whitespace proxies leave behind", () => {
    expect(callerAddress(headers({ "x-forwarded-for": "  203.0.113.7 " }))).toBe(
      "203.0.113.7",
    );
  });

  it("falls back to x-real-ip, then to a constant", () => {
    expect(callerAddress(headers({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
    expect(callerAddress(headers({}))).toBe("unknown");
  });

  it("does not treat an empty forwarded header as an address", () => {
    expect(
      callerAddress(headers({ "x-forwarded-for": "", "x-real-ip": "198.51.100.4" })),
    ).toBe("198.51.100.4");
    expect(callerAddress(headers({ "x-forwarded-for": "   " }))).toBe("unknown");
  });

  it("lumps every unidentifiable caller together rather than letting them through", () => {
    // They share one bucket. That is the intent: no header, no separate allowance.
    expect(callerAddress(headers({}))).toBe(callerAddress(headers({})));
  });
});
