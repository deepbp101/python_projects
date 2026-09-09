import type { Metadata } from "next";
import { MoodBoardView } from "@/components/mood-board";
import { NoAccess } from "@/components/no-access";
import { canChange, canSee, loadWorkspace } from "@/lib/page";
import { ensureMoodBoard } from "@/lib/services/moodboard";

export const metadata: Metadata = { title: "Mood board" };

export default async function MoodBoardPage({
  params,
}: {
  params: Promise<{ weddingId: string }>;
}) {
  const { weddingId } = await params;
  const { access } = await loadWorkspace(weddingId);

  if (!canSee(access, "MOODBOARD")) return <NoAccess section="The mood board" />;

  const board = await ensureMoodBoard(weddingId);

  return (
    <MoodBoardView
      weddingId={weddingId}
      canEdit={canChange(access, "MOODBOARD")}
      title={board.title}
      isShared={board.shareTokenHash !== null}
      items={board.items.map((item) => ({
        id: item.id,
        category: item.category,
        title: item.title,
        note: item.note,
        sourceUrl: item.sourceUrl,
        uploadId: item.uploadId,
        width: item.upload?.width ?? null,
        height: item.upload?.height ?? null,
      }))}
    />
  );
}
