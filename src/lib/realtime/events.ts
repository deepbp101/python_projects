/**
 * Realtime contract shared by the Socket.IO server and the browser client.
 *
 * The server broadcasts *what changed*, not the changed rows themselves.
 * Clients respond by refetching, so every collaborator converges on the same
 * server state without the app needing to merge concurrent edits by hand.
 */

export const WORKSPACE_EVENT = "workspace:changed";
export const PRESENCE_EVENT = "workspace:presence";

export type WorkspaceResource =
  | "wedding"
  | "tasks"
  | "budget"
  | "guests"
  | "collaborators"
  | "seating"
  | "site"
  | "moodboard";

export type WorkspaceChangedPayload = {
  weddingId: string;
  resource: WorkspaceResource;
  /** The user who made the change, so a client can ignore its own echo. */
  actorId: string | null;
  at: string;
};

export type PresencePayload = {
  weddingId: string;
  viewers: { userId: string; name: string }[];
};

export const weddingRoom = (weddingId: string) => `wedding:${weddingId}`;
