import { ApiError, ok, parseBody, requireWorkspaceOwner, route } from "@/lib/api";
import { AI_MODEL, AiUnavailableError, generateText } from "@/lib/ai/client";
import { buildDraftRequest, DRAFT_KIND_LABELS } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db";
import {
  canGenerate,
  outputTokenBudget,
  planDefinition,
  tokensRemaining,
} from "@/lib/domain/plans";
import { loadDraftContext, loadDrafts } from "@/lib/services/assistant";
import {
  loadAiUsage,
  loadPlan,
  PlanLimitError,
  recordAiUsage,
  requireCapacity,
  requireFeature,
} from "@/lib/services/plan";
import { generateDraftSchema } from "@/lib/validation";

type Params = { params: Promise<{ weddingId: string }> };

export const GET = route(async (_request: Request, { params }: Params) => {
  const { weddingId } = await params;
  await requireWorkspaceOwner(weddingId);
  return ok({ drafts: await loadDrafts(weddingId) });
});

/**
 * Writes a draft and saves it.
 *
 * Limited to the couple. Vows and speeches are the most personal writing in the
 * whole app, and a planner or a relative having them on tap is not a default
 * anyone would choose — the rest of the workspace is shared, this is not.
 *
 * A missing or rejected API key comes back as a 503 with a sentence explaining
 * what to set, rather than a 500: "the assistant is switched off" is a
 * configuration state, not a crash.
 */
export const POST = route(async (request: Request, { params }: Params) => {
  const { weddingId } = await params;
  const context = await requireWorkspaceOwner(weddingId);
  const input = await parseBody(request, generateDraftSchema);

  await requireFeature(weddingId, "aiWriting");
  await requireCapacity(weddingId, "aiDrafts", "saved drafts");

  // The month's budget is checked before spending anything, and the request's own
  // ceiling is lowered to whatever is left — so the last generation of the month
  // comes back short rather than not at all.
  const plan = await loadPlan(weddingId);
  const usage = await loadAiUsage(weddingId);

  if (!canGenerate(plan, usage.used)) {
    // No number in the sentence: the meter counts model tokens, and quoting that
    // figure to a couple planning a wedding measures the wrong thing in a unit
    // they have no use for. The exact counts are in the details, and on the
    // settings page.
    throw new PlanLimitError(
      `You've used this month's assistant allowance. It resets on the 1st${
        plan === "FREE" ? ", or Pro raises the allowance" : ""
      }.`,
      {
        period: usage.period,
        used: usage.used,
        allowance: planDefinition(plan).aiTokensPerMonth,
        remaining: tokensRemaining(plan, usage.used),
      },
    );
  }

  const { system, prompt, maxTokens } = buildDraftRequest({
    kind: input.kind,
    brief: input.brief,
    tone: input.tone,
    length: input.length,
    context: await loadDraftContext(weddingId),
  });

  let content: string;
  try {
    const generation = await generateText({
      system,
      prompt,
      maxTokens: outputTokenBudget(plan, usage.used, maxTokens),
    });
    content = generation.text;
    // Charged after the fact, from what the API reported — a failed call is free.
    await recordAiUsage(weddingId, generation.usage);
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      throw new ApiError(503, error.message);
    }
    throw error;
  }

  const draft = await prisma.aiDraft.create({
    data: {
      weddingId,
      kind: input.kind,
      title: input.title || DRAFT_KIND_LABELS[input.kind],
      prompt: input.brief,
      content,
      model: AI_MODEL,
      createdById: context.user.id,
    },
    select: {
      id: true,
      kind: true,
      title: true,
      prompt: true,
      content: true,
      model: true,
      createdAt: true,
    },
  });

  return ok(
    {
      draft,
      tokensLeft: tokensRemaining(plan, (await loadAiUsage(weddingId)).used),
    },
    201,
  );
});
