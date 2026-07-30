import type { Metadata } from "next";
import { AssistantBoard } from "@/components/assistant-board";
import { NoAccess } from "@/components/no-access";
import { isAiConfigured } from "@/lib/ai/client";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import { loadDrafts } from "@/lib/services/assistant";
import { loadStyleProfile } from "@/lib/services/style";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access, role } = await loadWorkspace(weddingId);

  // The style side follows mood board access; the writing side is couple-only.
  if (!canSee(access, "MOODBOARD")) return <NoAccess section="The assistant" />;

  const isCouple = role === "OWNER" || role === "PARTNER";

  const [drafts, profile] = await Promise.all([
    isCouple ? loadDrafts(weddingId) : Promise.resolve([]),
    loadStyleProfile(weddingId),
  ]);

  return (
    <AssistantBoard
      weddingId={weddingId}
      aiConfigured={isAiConfigured()}
      canWrite={isCouple}
      canStyle={canChange(access, "MOODBOARD")}
      drafts={drafts.map((draft) => ({
        id: draft.id,
        kind: draft.kind,
        title: draft.title,
        prompt: draft.prompt,
        content: draft.content,
        model: draft.model,
        createdAt: draft.createdAt.toISOString(),
      }))}
      profile={
        profile
          ? {
              answers: profile.answers,
              themes: profile.themes,
              summary: profile.summary,
              updatedAt: profile.updatedAt.toISOString(),
            }
          : null
      }
    />
  );
}
