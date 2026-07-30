import { describe, expect, it } from "vitest";
import {
  canGenerate,
  describeLimit,
  fitsWithinLimit,
  hasFeature,
  limitFor,
  limitMessage,
  MIN_USEFUL_OUTPUT_TOKENS,
  outputTokenBudget,
  PLAN_DEFINITIONS,
  PLANS,
  remainingOf,
  tokensRemaining,
  UNLIMITED,
  usagePeriod,
  type CountableLimit,
  type PlanFeature,
} from "@/lib/domain/plans";

const LIMITS = Object.keys(PLAN_DEFINITIONS.FREE.limits) as CountableLimit[];
const FEATURES = Object.keys(PLAN_DEFINITIONS.FREE.features) as PlanFeature[];

describe("the plan table", () => {
  it("never gives Free more than Pro", () => {
    for (const limit of LIMITS) {
      expect(limitFor("FREE", limit)).toBeLessThanOrEqual(limitFor("PRO", limit));
    }
    for (const feature of FEATURES) {
      if (hasFeature("FREE", feature)) {
        expect(hasFeature("PRO", feature)).toBe(true);
      }
    }
    expect(PLAN_DEFINITIONS.FREE.aiTokensPerMonth).toBeLessThan(
      PLAN_DEFINITIONS.PRO.aiTokensPerMonth,
    );
  });

  it("leaves Pro with nothing switched off", () => {
    for (const feature of FEATURES) expect(hasFeature("PRO", feature)).toBe(true);
    for (const limit of LIMITS) expect(limitFor("PRO", limit)).toBe(UNLIMITED);
  });

  it("gives free a monthly allowance worth more than one generation", () => {
    for (const plan of PLANS) {
      expect(PLAN_DEFINITIONS[plan].aiTokensPerMonth).toBeGreaterThan(
        PLAN_DEFINITIONS[plan].aiMaxOutputTokens,
      );
    }
  });
});

describe("fitsWithinLimit", () => {
  it("allows filling a plan exactly to its ceiling", () => {
    expect(fitsWithinLimit("FREE", "guests", 39, 1)).toBe(true);
    expect(fitsWithinLimit("FREE", "guests", 40, 1)).toBe(false);
  });

  it("judges a bulk import as a whole, not row by row", () => {
    // 20 already there, 30 more: every single row would fit, the batch does not.
    expect(fitsWithinLimit("FREE", "guests", 20, 1)).toBe(true);
    expect(fitsWithinLimit("FREE", "guests", 20, 30)).toBe(false);
    expect(fitsWithinLimit("FREE", "guests", 20, 20)).toBe(true);
  });

  it("never refuses anything on an unlimited plan", () => {
    expect(fitsWithinLimit("PRO", "guests", 10_000, 5_000)).toBe(true);
  });

  it("reports what is left, and stops at zero", () => {
    expect(remainingOf("FREE", "vendors", 2)).toBe(3);
    expect(remainingOf("FREE", "vendors", 9)).toBe(0);
    expect(remainingOf("PRO", "vendors", 9)).toBe(UNLIMITED);
  });
});

describe("the message shown when a limit bites", () => {
  it("names the current ceiling and what upgrading gives", () => {
    const message = limitMessage("FREE", "guests", "guests");
    expect(message).toContain("40");
    expect(message).toContain("Pro");
  });

  it("does not tell a Pro customer to upgrade to Pro", () => {
    expect(limitMessage("PRO", "guests", "guests")).not.toMatch(
      /Pro raises|upgrade/i,
    );
  });

  it("writes infinity as a word", () => {
    expect(describeLimit(UNLIMITED)).toBe("unlimited");
    expect(describeLimit(1500)).toBe("1,500");
  });
});

describe("the token meter", () => {
  it("counts down and floors at zero", () => {
    expect(tokensRemaining("FREE", 0)).toBe(30_000);
    expect(tokensRemaining("FREE", 29_000)).toBe(1_000);
    expect(tokensRemaining("FREE", 999_999)).toBe(0);
  });

  it("buckets by UTC calendar month", () => {
    expect(usagePeriod(new Date("2026-07-30T23:00:00Z"))).toBe("2026-07");
    expect(usagePeriod(new Date("2026-08-01T00:00:00Z"))).toBe("2026-08");
    // A January date must pad to two digits or the keys sort wrongly.
    expect(usagePeriod(new Date("2027-01-04T12:00:00Z"))).toBe("2027-01");
  });
});

describe("outputTokenBudget", () => {
  it("caps a single request at the plan's ceiling", () => {
    expect(outputTokenBudget("FREE", 0, 8_000)).toBe(1_024);
    expect(outputTokenBudget("PRO", 0, 8_000)).toBe(4_096);
  });

  it("honours a smaller request", () => {
    expect(outputTokenBudget("FREE", 0, 300)).toBe(300);
  });

  it("shrinks to what is left of the month rather than overspending", () => {
    expect(outputTokenBudget("FREE", 29_400, 1_024)).toBe(600);
  });

  it("reaches zero once the month is spent", () => {
    expect(outputTokenBudget("FREE", 30_000, 1_024)).toBe(0);
    expect(outputTokenBudget("FREE", 40_000, 1_024)).toBe(0);
  });
});

describe("canGenerate", () => {
  it("stops short of a uselessly small answer", () => {
    expect(canGenerate("FREE", 30_000 - MIN_USEFUL_OUTPUT_TOKENS)).toBe(true);
    expect(canGenerate("FREE", 30_000 - MIN_USEFUL_OUTPUT_TOKENS + 1)).toBe(false);
  });

  it("agrees with the budget it would be given", () => {
    // The two must not disagree: a plan cleared to generate must get tokens.
    for (const used of [0, 15_000, 29_000, 29_800, 30_000]) {
      if (canGenerate("FREE", used)) {
        expect(outputTokenBudget("FREE", used, 1_024)).toBeGreaterThanOrEqual(
          MIN_USEFUL_OUTPUT_TOKENS,
        );
      }
    }
  });
});
