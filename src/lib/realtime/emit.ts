import type { Server } from "socket.io";
import {
  WORKSPACE_EVENT,
  weddingRoom,
  type WorkspaceChangedPayload,
  type WorkspaceResource,
} from "@/lib/realtime/events";

/**
 * The Socket.IO server lives in the custom server process (server.ts) but is
 * used from route handlers running in the same process, so it is parked on
 * `globalThis` rather than passed around.
 *
 * When there is no server attached — `next dev` without the custom server, or
 * a unit test — broadcasting is a no-op and mutations still work.
 */
const globalForIo = globalThis as unknown as { __weddingIo?: Server };

export function setRealtimeServer(io: Server): void {
  globalForIo.__weddingIo = io;
}

export function getRealtimeServer(): Server | undefined {
  return globalForIo.__weddingIo;
}

export function broadcastChange(
  weddingId: string,
  resource: WorkspaceResource,
  actorId: string | null = null,
): void {
  const payload: WorkspaceChangedPayload = {
    weddingId,
    resource,
    actorId,
    at: new Date().toISOString(),
  };
  globalForIo.__weddingIo?.to(weddingRoom(weddingId)).emit(
    WORKSPACE_EVENT,
    payload,
  );
}
