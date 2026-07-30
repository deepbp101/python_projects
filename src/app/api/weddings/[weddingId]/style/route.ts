import { ok, parseBody, requireWorkspace, route } from "@/lib/api";
import { AI_MODEL, AiUnavailableError, generateText } from "@/lib/ai/client";
import { buildStyleSummaryRequest } from "@/lib/ai/prompts";
import { canGenerate, outputTokenBudget } from "@/lib/domain/plans";
import { THEME_PROFILES } from "@/lib/domain/style";
import { loadDraftContext } from "@/lib/services/assistant";
import {
  loadAiUsage,
  loadPlan,
  recordAiUsage,
  requireFeature,
} from "@/lib/services/plan";
import {
  loadStyleProfile,
  saveStyleProfile,
  scoreForWedding,
} from "@/lib/services/style";
import { styleQuizSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "MOODBOARD", "VIEW");
  return ok({ profile: await loadStyleProfile(weddingId) });
});

/**
 * Scores the style quiz and saves the profile.
 *
 * The matching is done here, in the domain layer, before any model is involved —
 * the themes, palettes and vendor priorities are the same with or without an API
 * key. The model writes the summary paragraph and nothing else, so when it is
 * unavailable the summary is simply null and the results page still works.
 *
 * Sits behind MOODBOARD access rather than the couple-only rule the writing
 * assistant uses: this is a planning tool, and a planner should be able to run it.
 */
export const PUT = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspace(weddingId, "MOODBOARD", "EDIT");
  const { answers } = await parseBody(request, styleQuizSchema);

  await requireFeature(weddingId, "styleMatchmaker");

  const { scored, leaders, decor } = await scoreForWedding(weddingId, answers);

  let summary: string | null = null;
  let model: string | null = null;

  const plan = await loadPlan(weddingId);
  const usage = await loadAiUsage(weddingId);

  // The summary is the only part a model touches, so a spent budget costs the
  // paragraph and nothing else — the scored themes below are already computed.
  if (leaders.length > 0 && canGenerate(plan, usage.used)) {
    const { system, prompt, maxTokens } = buildStyleSummaryRequest({
      themes: leaders.map((entry) => ({
        label: THEME_PROFILES[entry.theme].label,
        score: entry.score,
      })),
      decor,
      context: await loadDraftContext(weddingId),
    });

    try {
      const generation = await generateText({
        system,
        prompt,
        maxTokens: outputTokenBudget(plan, usage.used, maxTokens),
      });
      summary = generation.text;
      model = AI_MODEL;
      await recordAiUsage(weddingId, generation.usage);
    } catch (error) {
      // A missing key is not a failure here — the scored themes are the feature.
      if (!(error instanceof AiUnavailableError)) throw error;
    }
  }

  await saveStyleProfile({ weddingId, answers, themes: scored, summary, model });

  return ok({ profile: await loadStyleProfile(weddingId) });
});
