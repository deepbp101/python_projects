import { describe, expect, it } from "vitest";
import {
  isQuizComplete,
  scoreStyle,
  STYLE_QUIZ,
  STYLE_THEMES,
  suggestedCategories,
  THEME_PROFILES,
  topThemes,
} from "@/lib/domain/style";

/**
 * The matchmaker's scoring is the part that must not drift: it runs with or
 * without a model, and the model only writes prose about whatever comes out here.
 */

const gardenAnswers = {
  venue: "garden",
  palette: "blush",
  formality: "garden-party",
  evening: "longdinner",
  light: "golden",
  splurge: "flowers",
};

const modernAnswers = {
  venue: "loft",
  palette: "monochrome",
  formality: "cocktail",
  evening: "cocktails",
  light: "clean",
  splurge: "venue",
};

describe("scoreStyle", () => {
  it("puts the answered-for theme on top", () => {
    expect(scoreStyle(gardenAnswers)[0].theme).toBe("GARDEN_ROMANTIC");
    expect(scoreStyle(modernAnswers)[0].theme).toBe("MODERN_MINIMAL");
  });

  it("returns every theme, with scores summing to roughly 100", () => {
    const scored = scoreStyle(gardenAnswers);
    expect(scored).toHaveLength(STYLE_THEMES.length);

    const total = scored.reduce((sum, entry) => sum + entry.score, 0);
    // Rounding each share to a whole percent can drift a point or two.
    expect(total).toBeGreaterThanOrEqual(97);
    expect(total).toBeLessThanOrEqual(103);
  });

  it("is deterministic — the same answers always score the same", () => {
    expect(scoreStyle(gardenAnswers)).toEqual(scoreStyle(gardenAnswers));
  });

  it("scores everything zero when nothing is answered", () => {
    const scored = scoreStyle({});
    expect(scored.every((entry) => entry.score === 0)).toBe(true);
    expect(topThemes(scored)).toEqual([]);
  });

  it("ignores unknown questions and unknown options", () => {
    const withJunk = scoreStyle({
      ...gardenAnswers,
      nosuchquestion: "whatever",
      venue: "nosuchoption",
    });
    // The bad venue answer drops out; the rest still score.
    expect(withJunk[0].theme).toBe("GARDEN_ROMANTIC");
    expect(withJunk.some((entry) => entry.score > 0)).toBe(true);
  });

  it("breaks ties in a fixed order so results never reshuffle", () => {
    const tied = scoreStyle({});
    expect(tied.map((entry) => entry.theme)).toEqual(STYLE_THEMES);
  });

  it("lets the mood board nudge the result without deciding it", () => {
    const withoutBoard = scoreStyle(modernAnswers);
    const withFlorals = scoreStyle(modernAnswers, { FLORALS: 3 });

    const garden = (list: typeof withoutBoard) =>
      list.find((entry) => entry.theme === "GARDEN_ROMANTIC")!.score;

    expect(garden(withFlorals)).toBeGreaterThan(garden(withoutBoard));
    // A board full of florals is a hint, not an override.
    expect(withFlorals[0].theme).toBe("MODERN_MINIMAL");
  });

  it("stops counting after a few pins in the same category", () => {
    const three = scoreStyle(modernAnswers, { FLORALS: 3 });
    const thirty = scoreStyle(modernAnswers, { FLORALS: 30 });
    expect(thirty).toEqual(three);
  });
});

describe("topThemes", () => {
  it("returns the leaders and drops anything scoring nothing", () => {
    const leaders = topThemes(scoreStyle(gardenAnswers));
    expect(leaders.length).toBeGreaterThan(0);
    expect(leaders.length).toBeLessThanOrEqual(2);
    expect(leaders.every((entry) => entry.score > 0)).toBe(true);
  });
});

describe("suggestedCategories", () => {
  it("de-duplicates across the leading themes, keeping their order", () => {
    const categories = suggestedCategories(scoreStyle(gardenAnswers));
    expect(new Set(categories).size).toBe(categories.length);
    expect(categories[0]).toBe(
      THEME_PROFILES.GARDEN_ROMANTIC.priorities[0],
    );
  });

  it("returns nothing when the quiz has not been taken", () => {
    expect(suggestedCategories(scoreStyle({}))).toEqual([]);
  });
});

describe("the quiz itself", () => {
  it("has unique question and option ids", () => {
    const ids = STYLE_QUIZ.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const question of STYLE_QUIZ) {
      const optionIds = question.options.map((option) => option.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
    }
  });

  it("only ever weights themes that exist", () => {
    for (const question of STYLE_QUIZ) {
      for (const option of question.options) {
        for (const theme of Object.keys(option.weights)) {
          expect(STYLE_THEMES).toContain(theme);
        }
      }
    }
  });

  it("gives every theme a profile with a palette and priorities", () => {
    for (const theme of STYLE_THEMES) {
      const profile = THEME_PROFILES[theme];
      expect(profile.palette.length).toBeGreaterThan(2);
      expect(profile.priorities.length).toBeGreaterThan(0);
      for (const hex of profile.palette) {
        expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("can be reached by at least one answer per theme", () => {
    // A theme nothing can score is dead weight in the results.
    const reachable = new Set(
      STYLE_QUIZ.flatMap((question) =>
        question.options.flatMap((option) => Object.keys(option.weights)),
      ),
    );
    for (const theme of STYLE_THEMES) expect(reachable).toContain(theme);
  });
});

describe("isQuizComplete", () => {
  it("is true only when every question has a recognised answer", () => {
    expect(isQuizComplete(gardenAnswers)).toBe(true);
    expect(isQuizComplete({ ...gardenAnswers, light: "nonsense" })).toBe(false);
    expect(isQuizComplete({})).toBe(false);
  });
});
