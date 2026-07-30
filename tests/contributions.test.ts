import { describe, expect, it } from "vitest";
import {
  isPubliclyVisible,
  summarizeContributions,
} from "@/lib/domain/contributions";

/**
 * "Who can see this" is the rule that must not be subtly wrong — anyone with the
 * site link can post, so the couple's control over what appears is the whole
 * safeguard. The public pages and the couple's badges both read from here.
 */

const at = (iso: string) => new Date(iso);

describe("isPubliclyVisible", () => {
  it("with moderation on, needs explicit approval", () => {
    expect(
      isPubliclyVisible({ approvedAt: null, hiddenAt: null }, true),
    ).toBe(false);
    expect(
      isPubliclyVisible({ approvedAt: at("2027-01-01"), hiddenAt: null }, true),
    ).toBe(true);
  });

  it("with moderation off, anything not hidden is live", () => {
    expect(
      isPubliclyVisible({ approvedAt: null, hiddenAt: null }, false),
    ).toBe(true);
  });

  it("hidden always wins, whatever the moderation setting", () => {
    const pulled = { approvedAt: at("2027-01-01"), hiddenAt: at("2027-01-02") };
    expect(isPubliclyVisible(pulled, true)).toBe(false);
    expect(isPubliclyVisible(pulled, false)).toBe(false);
  });

  it("keeps a pulled item pulled when moderation is switched off", () => {
    // Turning moderation off publishes the waiting queue — but not the things the
    // couple deliberately took down.
    const items = [
      { approvedAt: null, hiddenAt: null },
      { approvedAt: null, hiddenAt: at("2027-01-02") },
    ];
    expect(items.map((item) => isPubliclyVisible(item, false))).toEqual([
      true,
      false,
    ]);
  });
});

describe("summarizeContributions", () => {
  const items = [
    { approvedAt: at("2027-01-01"), hiddenAt: null },
    { approvedAt: null, hiddenAt: null },
    { approvedAt: null, hiddenAt: null },
    { approvedAt: at("2027-01-01"), hiddenAt: at("2027-01-03") },
  ];

  it("counts live, waiting and hidden with moderation on", () => {
    expect(summarizeContributions(items, true)).toEqual({
      total: 4,
      visible: 1,
      pending: 2,
      hidden: 1,
    });
  });

  it("moves the queue into live when moderation is off", () => {
    expect(summarizeContributions(items, false)).toEqual({
      total: 4,
      visible: 3,
      pending: 0,
      hidden: 1,
    });
  });

  it("handles an empty list", () => {
    expect(summarizeContributions([], true)).toEqual({
      total: 0,
      visible: 0,
      pending: 0,
      hidden: 0,
    });
  });
});
