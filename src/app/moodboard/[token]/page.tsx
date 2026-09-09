import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MoodCard } from "@/components/mood-board";
import { formatLongDate } from "@/lib/dates";
import { loadSharedBoard } from "@/lib/services/moodboard";

type Params = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Mood board",
  robots: { index: false },
};

/**
 * Read-only mood board for anyone holding the share link — usually a florist or
 * stylist. No account needed, and revoking the link makes this a 404 at once.
 */
export default async function SharedMoodBoardPage({ params }: Params) {
  const { token } = await params;
  const board = await loadSharedBoard(token);
  if (!board) notFound();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-line bg-surface px-5 py-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-clay">
          {board.wedding.title}
        </p>
        <h1 className="mt-3 font-display text-3xl text-ink">{board.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {formatLongDate(board.wedding.weddingDate)}
        </p>
      </header>

      <main className="mx-auto w-full max-w-5xl p-5 sm:p-8">
        {board.items.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-soft">
            Nothing has been added to this board yet.
          </p>
        ) : (
          <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
            {board.items.map((item) => (
              <MoodCard
                key={item.id}
                shareToken={token}
                item={{
                  id: item.id,
                  category: item.category,
                  title: item.title,
                  note: item.note,
                  sourceUrl: item.sourceUrl,
                  uploadId: item.uploadId,
                  width: item.upload?.width ?? null,
                  height: item.upload?.height ?? null,
                }}
              />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 pb-10 text-center text-xs text-ink-faint">
        Shared from Wedding Planner
      </footer>
    </div>
  );
}
