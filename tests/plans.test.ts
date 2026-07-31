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
    expect(PLAN_DEFINITIONS.FREE.aiTokenAllowance).toBeLessThan(
      PLAN_DEFINITIONS.PRO.aiTokenAllowance,
    );
  });

  it("leaves Pro with nothing switched off", () => {
    for (const feature of FEATURES) expect(hasFeature("PRO", feature)).toBe(true);
    for (const limit of LIMITS) expect(limitFor("PRO", limit)).toBe(UNLIMITED);
  });

  it("gives every plan a pool worth many generations, not one", () => {
    for (const plan of PLANS) {
      // A pool that only covers a handful of requests would be a demo, not a
      // tier — and on Pro it is bought once, so it has to last the engagement.
      expect(PLAN_DEFINITIONS[plan].aiTokenAllowance).toBeGreaterThan(
        PLAN_DEFINITIONS[plan].aiMaxOutputTokens * 10,
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

const FREE_POOL = PLAN_DEFINITIONS.FREE.aiTokenAllowance;

describe("the token pool", () => {
  it("counts down and floors at zero", () => {
    expect(tokensRemaining("FREE", 0)).toBe(FREE_POOL);
    expect(tokensRemaining("FREE", FREE_POOL - 1_000)).toBe(1_000);
    expect(tokensRemaining("FREE", FREE_POOL * 10)).toBe(0);
  });

  it("treats spending spread over time exactly like spending it at once", () => {
    // This is what makes it a pool rather than a window: usage accumulates, and
    // no boundary between the chunks gives any of it back. Under the old monthly
    // reset these two would disagree the moment the chunks straddled the 1st.
    const chunks = [4_000, 11_000, 7_500, 2_500];
    const total = chunks.reduce((sum, chunk) => sum + chunk, 0);

    let remaining = FREE_POOL;
    for (const chunk of chunks) remaining -= chunk;

    expect(tokensRemaining("FREE", total)).toBe(remaining);
    expect(tokensRemaining("FREE", total)).toBe(FREE_POOL - 25_000);
  });

  it("never hands anything back once spent", () => {
    expect(tokensRemaining("FREE", FREE_POOL)).toBe(0);
    expect(canGenerate("FREE", FREE_POOL)).toBe(false);
  });
});

describe("usagePeriod", () => {
  it("still buckets by UTC calendar month, for the ledger", () => {
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

  it("shrinks to what is left of the pool rather than overspending", () => {
    expect(outputTokenBudget("FREE", FREE_POOL - 600, 1_024)).toBe(600);
  });

  it("reaches zero once the pool is spent, and stays there", () => {
    expect(outputTokenBudget("FREE", FREE_POOL, 1_024)).toBe(0);
    expect(outputTokenBudget("FREE", FREE_POOL * 2, 1_024)).toBe(0);
  });
});

describe("canGenerate", () => {
  it("stops short of a uselessly small answer", () => {
    expect(canGenerate("FREE", FREE_POOL - MIN_USEFUL_OUTPUT_TOKENS)).toBe(true);
    expect(canGenerate("FREE", FREE_POOL - MIN_USEFUL_OUTPUT_TOKENS + 1)).toBe(
      false,
    );
  });

  it("agrees with the budget it would be given", () => {
    // The two must not disagree: a plan cleared to generate must get tokens.
    const points = [0, FREE_POOL / 2, FREE_POOL - 1_000, FREE_POOL - 200, FREE_POOL];
    for (const used of points) {
      if (canGenerate("FREE", used)) {
        expect(outputTokenBudget("FREE", used, 1_024)).toBeGreaterThanOrEqual(
          MIN_USEFUL_OUTPUT_TOKENS,
        );
      }
    }
  });
});
