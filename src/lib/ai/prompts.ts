import type { AiDraftKind } from "@/generated/prisma/enums";

/**
 * Prompts for the writing assistant.
 *
 * Kept separate from the client so the wording is reviewable on its own, and
 * free of database imports so the UI can share the labels.
 *
 * Two things every prompt here insists on: write in the couple's voice rather
 * than about them, and return only the piece — no "Here is a draft" preamble, no
 * headings, no options list. Assistant prefill is not available on current
 * models, so a system-prompt instruction is the lever for that.
 */

export const DRAFT_KINDS: AiDraftKind[] = [
  "VOWS",
  "SPEECH",
  "THANK_YOU",
  "INVITATION",
];

export const DRAFT_KIND_LABELS: Record<AiDraftKind, string> = {
  VOWS: "Vows",
  SPEECH: "Speech or toast",
  THANK_YOU: "Thank-you note",
  INVITATION: "Invitation wording",
};

export const DRAFT_KIND_HINTS: Record<AiDraftKind, string> = {
  VOWS: "What you want to promise, and a detail or two only you would know.",
  SPEECH: "Who is speaking, who they are toasting, and a story worth telling.",
  THANK_YOU: "Who it is for and what they gave or did.",
  INVITATION: "Anything guests must know — dress code, timings, who is hosting.",
};

export type DraftTone = "WARM" | "FUNNY" | "FORMAL" | "PLAIN";

export const DRAFT_TONES: DraftTone[] = ["WARM", "FUNNY", "FORMAL", "PLAIN"];

export const DRAFT_TONE_LABELS: Record<DraftTone, string> = {
  WARM: "Warm",
  FUNNY: "Light and funny",
  FORMAL: "Formal",
  PLAIN: "Plain and direct",
};

const TONE_GUIDANCE: Record<DraftTone, string> = {
  WARM: "Warm and sincere. Specific rather than sentimental — no greeting-card lines.",
  FUNNY:
    "Light and affectionate. Land one or two real jokes; never make anyone the butt of it.",
  FORMAL: "Formal and traditional, in complete sentences. No contractions.",
  PLAIN: "Plain and direct. Short sentences. No flourishes, no metaphor.",
};

export type DraftLength = "SHORT" | "MEDIUM" | "LONG";

export const DRAFT_LENGTHS: DraftLength[] = ["SHORT", "MEDIUM", "LONG"];

export const DRAFT_LENGTH_LABELS: Record<DraftLength, string> = {
  SHORT: "Short",
  MEDIUM: "Medium",
  LONG: "Long",
};

const LENGTH_GUIDANCE: Record<DraftLength, string> = {
  SHORT: "Around 80 words.",
  MEDIUM: "Around 200 words.",
  LONG: "Around 400 words.",
};

const KIND_GUIDANCE: Record<AiDraftKind, string> = {
  VOWS:
    "Write wedding vows, spoken in the first person to their partner. Promises should be concrete things a person could actually do, not abstractions. No 'I promise to always be there for you'.",
  SPEECH:
    "Write a wedding speech to be read aloud. Open with who is speaking and their connection, tell one story, then land on a toast. Write for the ear: short sentences, no parentheses.",
  THANK_YOU:
    "Write a thank-you note. Name the specific gift or act and say something true about the person. Two short paragraphs at most, however long the target length.",
  INVITATION:
    "Write invitation wording only — the text that goes on the card. No explanation, no alternatives, no notes about layout. Keep the line breaks meaningful, since they will be set as written.",
};

export type DraftContext = {
  coupleNames: string;
  weddingDate: string;
  venueName: string | null;
  location: string | null;
  /** Style themes from the matchmaker, when the couple has taken the quiz. */
  themes: string[];
};

function contextLines(context: DraftContext): string {
  const lines = [
    `Couple: ${context.coupleNames}`,
    `Date: ${context.weddingDate}`,
  ];
  if (context.venueName) lines.push(`Venue: ${context.venueName}`);
  if (context.location) lines.push(`Location: ${context.location}`);
  if (context.themes.length > 0) {
    lines.push(`Style: ${context.themes.join(", ")}`);
  }
  return lines.join("\n");
}

export type DraftRequest = {
  kind: AiDraftKind;
  brief: string;
  tone: DraftTone;
  length: DraftLength;
  context: DraftContext;
};

/**
 * Builds the request for one draft.
 *
 * `maxTokens` is set from the requested length with generous headroom — a piece
 * cut off mid-sentence is worse than one slightly over.
 */
export function buildDraftRequest(request: DraftRequest): {
  system: string;
  prompt: string;
  maxTokens: number;
} {
  const system = [
    "You write for a couple planning their wedding. You are a ghostwriter: the words are theirs, not yours.",
    "",
    KIND_GUIDANCE[request.kind],
    "",
    `Tone: ${TONE_GUIDANCE[request.tone]}`,
    `Length: ${LENGTH_GUIDANCE[request.length]}`,
    "",
    "Rules:",
    "- Return only the piece itself. No preamble, no sign-off from you, no headings, no notes, no alternatives.",
    "- Never invent specifics you were not given — no fake anecdotes, place names, dates or relatives. If the brief is thin, write something true but general rather than making something up.",
    "- Leave a placeholder in square brackets when a detail is genuinely needed and missing, for example [name of your grandmother].",
    "- Plain text. No markdown, no emoji.",
  ].join("\n");

  const prompt = [
    "Here is what we know about the wedding:",
    contextLines(request.context),
    "",
    "What we want you to write:",
    request.brief.trim(),
  ].join("\n");

  const maxTokens =
    request.length === "SHORT" ? 1024 : request.length === "MEDIUM" ? 2048 : 4096;

  return { system, prompt, maxTokens };
}

/**
 * The style matchmaker's summary.
 *
 * The model is handed the themes that were already scored deterministically and
 * asked only to describe them — it does not choose the recommendations, so a
 * different model or no model at all changes the prose, never the matching.
 */
export function buildStyleSummaryRequest({
  themes,
  decor,
  context,
}: {
  themes: { label: string; score: number }[];
  decor: string[];
  context: DraftContext;
}): { system: string; prompt: string; maxTokens: number } {
  const system = [
    "You describe a couple's wedding style back to them in a single paragraph.",
    "",
    "Rules:",
    "- Use only the themes and details given. Do not add themes, colours or vendors of your own.",
    "- Write to the couple, as 'you'. Around 90 words, one paragraph.",
    "- Be concrete and a little opinionated: say what this look does well and what it needs to get right.",
    "- Return only the paragraph. No heading, no list, no preamble. Plain text.",
  ].join("\n");

  const prompt = [
    contextLines(context),
    "",
    `Their strongest style matches: ${themes
      .map((theme) => `${theme.label} (${theme.score}%)`)
      .join(", ")}`,
    "",
    `Decor elements that go with it: ${decor.join("; ")}`,
  ].join("\n");

  return { system, prompt, maxTokens: 512 };
}
