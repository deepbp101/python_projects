import type { MoodCategory, VendorCategory } from "@/generated/prisma/enums";

/**
 * The style matchmaker's scoring.
 *
 * Deliberately deterministic and model-free: the quiz answers score into themes
 * by fixed weights here, and the model's only job is writing the summary
 * paragraph. That means the recommendations are reproducible, testable, and still
 * work when no API key is configured — a matchmaker that returns nothing without
 * a model would be a worse feature than one that returns slightly drier prose.
 */

export type StyleTheme =
  | "GARDEN_ROMANTIC"
  | "MODERN_MINIMAL"
  | "RUSTIC_WARM"
  | "CLASSIC_FORMAL"
  | "COASTAL_AIRY"
  | "MOODY_DRAMATIC";

/** Fixed order, used to break score ties so results never reshuffle. */
export const STYLE_THEMES: StyleTheme[] = [
  "GARDEN_ROMANTIC",
  "MODERN_MINIMAL",
  "RUSTIC_WARM",
  "CLASSIC_FORMAL",
  "COASTAL_AIRY",
  "MOODY_DRAMATIC",
];

export type ThemeProfile = {
  label: string;
  blurb: string;
  /** Hex swatches, shown as the palette on the results card. */
  palette: string[];
  decor: string[];
  /** Vendor categories worth booking first for this look. */
  priorities: VendorCategory[];
};

export const THEME_PROFILES: Record<StyleTheme, ThemeProfile> = {
  GARDEN_ROMANTIC: {
    label: "Garden romantic",
    blurb:
      "Loose flowers, soft light and a lot of green. Reads as unfussy even when it took a lot of planning.",
    palette: ["#E8D5D0", "#C9A0A0", "#7D8471", "#F4F1EA", "#B08968"],
    decor: [
      "Unstructured garden roses and foliage",
      "Taper candles at mixed heights",
      "Linen runners, no full cloths",
      "Fruit and herbs on the table",
    ],
    priorities: ["FLORIST", "VENUE", "PHOTOGRAPHY", "RENTALS"],
  },
  MODERN_MINIMAL: {
    label: "Modern minimal",
    blurb:
      "Clean lines, restraint, and one or two things done extremely well rather than many done adequately.",
    palette: ["#FFFFFF", "#1C1C1C", "#D8D3CB", "#A9A29B", "#C6A664"],
    decor: [
      "Single-variety florals in volume",
      "Architectural or sculptural installation",
      "Matte ceramics and unpolished glass",
      "Type-led stationery, no flourishes",
    ],
    priorities: ["VENUE", "PHOTOGRAPHY", "STATIONERY", "CATERING"],
  },
  RUSTIC_WARM: {
    label: "Rustic warm",
    blurb:
      "Wood, candlelight and long tables. Built around people staying at the table for hours.",
    palette: ["#B08968", "#7F5539", "#DDB892", "#EDE0D4", "#6B7F6E"],
    decor: [
      "Long communal tables",
      "Dried grasses and seasonal branches",
      "Warm brass and amber glass",
      "String lights overhead",
    ],
    priorities: ["VENUE", "CATERING", "RENTALS", "MUSIC"],
  },
  CLASSIC_FORMAL: {
    label: "Classic formal",
    blurb:
      "Black tie, symmetry and traditional service. The look that still reads well in fifty years.",
    palette: ["#1B1B3A", "#F8F6F2", "#C9B037", "#8C1C13", "#D9D9D9"],
    decor: [
      "Tall structured centrepieces",
      "Full-length cloths and chargers",
      "Engraved or letterpress stationery",
      "Live strings for the ceremony",
    ],
    priorities: ["VENUE", "CATERING", "MUSIC", "ATTIRE"],
  },
  COASTAL_AIRY: {
    label: "Coastal and airy",
    blurb:
      "Light fabrics, open air and a palette that gets out of the way of the view.",
    palette: ["#F2F4F3", "#A8C6C3", "#E4D5B7", "#7FA1A8", "#DAD2C5"],
    decor: [
      "Billowing fabric and open sides",
      "Pale wood and rope textures",
      "Low, wide arrangements",
      "Barefoot-friendly flooring",
    ],
    priorities: ["VENUE", "PHOTOGRAPHY", "RENTALS", "TRANSPORT"],
  },
  MOODY_DRAMATIC: {
    label: "Moody and dramatic",
    blurb:
      "Deep colour, low light and contrast. Feels like an event rather than an afternoon.",
    palette: ["#2B2118", "#6E2B3B", "#0F3D3E", "#C7A17A", "#161616"],
    decor: [
      "Dark blooms with heavy foliage",
      "Clustered pillar candles",
      "Velvet and slate textures",
      "Uplighting rather than daylight",
    ],
    priorities: ["VENUE", "MUSIC", "FLORIST", "PHOTOGRAPHY"],
  },
};

export type StyleQuestion = {
  id: string;
  prompt: string;
  options: {
    id: string;
    label: string;
    /** Theme weights this answer contributes. */
    weights: Partial<Record<StyleTheme, number>>;
  }[];
};

export const STYLE_QUIZ: StyleQuestion[] = [
  {
    id: "venue",
    prompt: "Where can you picture the day happening?",
    options: [
      { id: "garden", label: "A walled garden or greenhouse", weights: { GARDEN_ROMANTIC: 3, COASTAL_AIRY: 1 } },
      { id: "loft", label: "A gallery or concrete loft", weights: { MODERN_MINIMAL: 3, MOODY_DRAMATIC: 1 } },
      { id: "barn", label: "A barn or old mill", weights: { RUSTIC_WARM: 3, GARDEN_ROMANTIC: 1 } },
      { id: "hall", label: "A ballroom or historic hall", weights: { CLASSIC_FORMAL: 3, MOODY_DRAMATIC: 1 } },
    ],
  },
  {
    id: "palette",
    prompt: "Which set of colours feels most like you?",
    options: [
      { id: "blush", label: "Blush, cream and green", weights: { GARDEN_ROMANTIC: 3 } },
      { id: "monochrome", label: "White, black and one metal", weights: { MODERN_MINIMAL: 3, CLASSIC_FORMAL: 1 } },
      { id: "earth", label: "Terracotta, amber and wood", weights: { RUSTIC_WARM: 3 } },
      { id: "jewel", label: "Deep green, wine and gold", weights: { MOODY_DRAMATIC: 3, CLASSIC_FORMAL: 1 } },
    ],
  },
  {
    id: "formality",
    prompt: "What are people wearing?",
    options: [
      { id: "blacktie", label: "Black tie, properly", weights: { CLASSIC_FORMAL: 3, MOODY_DRAMATIC: 1 } },
      { id: "cocktail", label: "Cocktail, sharp but not stiff", weights: { MODERN_MINIMAL: 2, CLASSIC_FORMAL: 1 } },
      { id: "garden-party", label: "Garden party — linen and florals", weights: { GARDEN_ROMANTIC: 2, COASTAL_AIRY: 2 } },
      { id: "relaxed", label: "Whatever they can dance in", weights: { RUSTIC_WARM: 3 } },
    ],
  },
  {
    id: "evening",
    prompt: "How does the evening go?",
    options: [
      { id: "band", label: "A band and a full dance floor", weights: { RUSTIC_WARM: 2, MOODY_DRAMATIC: 2 } },
      { id: "longdinner", label: "A long dinner that never quite ends", weights: { GARDEN_ROMANTIC: 2, RUSTIC_WARM: 2 } },
      { id: "cocktails", label: "Cocktails, standing, good music low", weights: { MODERN_MINIMAL: 3 } },
      { id: "traditional", label: "Speeches, first dance, the order of things", weights: { CLASSIC_FORMAL: 3 } },
    ],
  },
  {
    id: "light",
    prompt: "Pick the light you want in the photos.",
    options: [
      { id: "golden", label: "Late afternoon, low and gold", weights: { GARDEN_ROMANTIC: 2, RUSTIC_WARM: 1, COASTAL_AIRY: 1 } },
      { id: "bright", label: "Bright and open, midday", weights: { COASTAL_AIRY: 3, MODERN_MINIMAL: 1 } },
      { id: "candle", label: "Candlelight and shadow", weights: { MOODY_DRAMATIC: 3 } },
      { id: "clean", label: "Even and clean, no drama", weights: { MODERN_MINIMAL: 2, CLASSIC_FORMAL: 2 } },
    ],
  },
  {
    id: "splurge",
    prompt: "If one thing gets the budget, what is it?",
    options: [
      { id: "flowers", label: "Flowers, everywhere", weights: { GARDEN_ROMANTIC: 3, MOODY_DRAMATIC: 1 } },
      { id: "food", label: "The food and the wine", weights: { RUSTIC_WARM: 2, CLASSIC_FORMAL: 1, MODERN_MINIMAL: 1 } },
      { id: "venue", label: "The room itself", weights: { CLASSIC_FORMAL: 2, MODERN_MINIMAL: 2 } },
      { id: "photos", label: "Photography — it's what's left", weights: { COASTAL_AIRY: 2, GARDEN_ROMANTIC: 1, MODERN_MINIMAL: 1 } },
    ],
  },
];

/**
 * Weak signals from what the couple has already pinned to their mood board.
 *
 * Weighted well below a quiz answer on purpose: a board heavy on florals hints at
 * a direction, but it is not the couple telling us their venue.
 */
const MOOD_SIGNALS: Partial<Record<MoodCategory, Partial<Record<StyleTheme, number>>>> = {
  FLORALS: { GARDEN_ROMANTIC: 1 },
  DECOR: { RUSTIC_WARM: 0.5, MOODY_DRAMATIC: 0.5 },
  VENUE: { CLASSIC_FORMAL: 0.5, COASTAL_AIRY: 0.5 },
  STATIONERY: { MODERN_MINIMAL: 1 },
  ATTIRE: { CLASSIC_FORMAL: 0.5, MODERN_MINIMAL: 0.5 },
  CAKE: { GARDEN_ROMANTIC: 0.5 },
  BEAUTY: { MODERN_MINIMAL: 0.5 },
};

export type ScoredTheme = {
  theme: StyleTheme;
  /** Share of total weight, 0-100, rounded. */
  score: number;
};

/**
 * Scores quiz answers (and optional mood board signals) into ranked themes.
 *
 * Unknown question or option ids are ignored rather than throwing — a saved
 * profile from an older version of the quiz should still render.
 */
export function scoreStyle(
  answers: Record<string, string>,
  moodCounts: Partial<Record<MoodCategory, number>> = {},
): ScoredTheme[] {
  const totals = new Map<StyleTheme, number>(
    STYLE_THEMES.map((theme) => [theme, 0]),
  );

  const add = (weights: Partial<Record<StyleTheme, number>>) => {
    for (const [theme, weight] of Object.entries(weights)) {
      const key = theme as StyleTheme;
      if (!totals.has(key)) continue;
      totals.set(key, (totals.get(key) ?? 0) + (weight ?? 0));
    }
  };

  for (const question of STYLE_QUIZ) {
    const chosen = answers[question.id];
    const option = question.options.find((candidate) => candidate.id === chosen);
    if (option) add(option.weights);
  }

  for (const [category, count] of Object.entries(moodCounts)) {
    const signal = MOOD_SIGNALS[category as MoodCategory];
    if (!signal || !count) continue;
    // Diminishing: the tenth florals pin says little the third did not.
    const strength = Math.min(count, 3);
    add(
      Object.fromEntries(
        Object.entries(signal).map(([theme, weight]) => [
          theme,
          (weight ?? 0) * strength,
        ]),
      ),
    );
  }

  const sum = [...totals.values()].reduce((acc, value) => acc + value, 0);

  return STYLE_THEMES.map((theme) => ({
    theme,
    score: sum === 0 ? 0 : Math.round(((totals.get(theme) ?? 0) / sum) * 100),
  })).sort(
    (a, b) =>
      b.score - a.score ||
      STYLE_THEMES.indexOf(a.theme) - STYLE_THEMES.indexOf(b.theme),
  );
}

/** The themes worth showing: the leader, plus any close second. */
export function topThemes(scored: ScoredTheme[], limit = 2): ScoredTheme[] {
  return scored.filter((entry) => entry.score > 0).slice(0, limit);
}

/**
 * Vendor categories to search first, from the leading themes — de-duplicated,
 * keeping the order the themes suggest.
 */
export function suggestedCategories(scored: ScoredTheme[]): VendorCategory[] {
  const ordered: VendorCategory[] = [];
  for (const entry of topThemes(scored)) {
    for (const category of THEME_PROFILES[entry.theme].priorities) {
      if (!ordered.includes(category)) ordered.push(category);
    }
  }
  return ordered;
}

/** True when every question has a recognised answer. */
export function isQuizComplete(answers: Record<string, string>): boolean {
  return STYLE_QUIZ.every((question) =>
    question.options.some((option) => option.id === answers[question.id]),
  );
}
