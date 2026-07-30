import { ApiError, ok, parseBody, requireWorkspaceOwner, route } from "@/lib/api";
import { AI_MODEL, AiUnavailableError, generateText } from "@/lib/ai/client";
import { buildDraftRequest, DRAFT_KIND_LABELS } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db";
import { loadDraftContext, loadDrafts } from "@/lib/services/assistant";
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

  const { system, prompt, maxTokens } = buildDraftRequest({
    kind: input.kind,
    brief: input.brief,
    tone: input.tone,
    length: input.length,
    context: await loadDraftContext(weddingId),
  });

  let content: string;
  try {
    content = await generateText({ system, prompt, maxTokens });
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

  return ok({ draft }, 201);
});
