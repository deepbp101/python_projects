import { useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import type { AccessLevel, WorkspaceSection } from "@/generated/prisma/enums";
import { useAuth } from "~/auth";
import { useCached, type Loaded } from "~/cache";
import { useLiveRefresh, type Presence } from "~/realtime";

/** Shape of GET /api/weddings/[weddingId]. */
export type Workspace = {
  wedding: {
    id: string;
    slug: string;
    title: string;
    weddingDate: string;
    currency: string;
    totalBudget: number;
    venueName: string | null;
    location: string | null;
    timezone: string;
  };
  role: string;
  access: Record<WorkspaceSection, AccessLevel>;
};

export function useWeddingId(): string {
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  return weddingId;
}

/**
 * Loads a workspace endpoint alongside the wedding itself, and keeps both live.
 *
 * Every screen needs the wedding (for its title, date and currency) and its own
 * payload, and both should refresh together when a collaborator changes
 * something — so the wiring lives here once rather than in each screen.
 */
export function useWorkspaceScreen<T>(path: string | null): {
  workspace: Loaded<Workspace>;
  screen: Loaded<T>;
  presence: Presence;
  refreshAll: () => Promise<void>;
  canEdit: (section: WorkspaceSection) => boolean;
} {
  const weddingId = useWeddingId();
  const { user } = useAuth();

  const workspace = useCached<Workspace>(`/api/weddings/${weddingId}`);
  const screen = useCached<T>(path);

  const refreshAll = useCallback(async () => {
    await Promise.all([workspace.refresh(), screen.refresh()]);
  }, [workspace.refresh, screen.refresh]);

  const presence = useLiveRefresh(weddingId ?? null, user?.id ?? null, () => {
    void refreshAll();
  });

  const canEdit = useCallback(
    (section: WorkspaceSection) =>
      workspace.data?.access?.[section] === "EDIT",
    [workspace.data],
  );

  return { workspace, screen, presence, refreshAll, canEdit };
}
