import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";
import {
  PRESENCE_EVENT,
  WORKSPACE_EVENT,
  type PresencePayload,
  type WorkspaceChangedPayload,
} from "@/lib/realtime/events";
import { API_URL, readToken } from "~/api";

/**
 * Live updates over the same Socket.IO server the web app uses.
 *
 * The event names and payload shapes are imported from the server's own
 * contract file rather than restated here — it is plain TypeScript with no
 * imports, so the phone gets the identical constants. A renamed event then
 * fails to compile instead of quietly never firing.
 *
 * The browser's handshake carries the session cookie automatically; a phone has
 * none, so the token goes in the handshake `auth` object, which is why
 * server.ts now reads both.
 */

// Must match `new Server(httpServer, { path: "/api/socket" })` in server.ts.
const SOCKET_PATH = "/api/socket";

export type Presence = { connected: boolean; viewers: PresencePayload["viewers"] };

/**
 * Refetches when someone else changes this wedding, and reports who else is
 * looking at it.
 *
 * `onChange` is held in a ref so a caller passing an inline closure does not
 * tear down and rebuild the socket on every render.
 */
export function useLiveRefresh(
  weddingId: string | null,
  userId: string | null,
  onChange: () => void,
): Presence {
  const handler = useRef(onChange);
  handler.current = onChange;

  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState<PresencePayload["viewers"]>([]);

  useEffect(() => {
    if (!weddingId) return;

    let socket: Socket | null = null;
    let cancelled = false;
    let burst: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      const token = await readToken();
      if (!token || cancelled) return;

      socket = io(API_URL, {
        path: SOCKET_PATH,
        auth: { token },
        transports: ["websocket"],
      });

      socket.on("connect", () => {
        setConnected(true);
        socket?.emit("join", weddingId);
      });
      socket.on("disconnect", () => setConnected(false));

      socket.on(WORKSPACE_EVENT, (payload: WorkspaceChangedPayload) => {
        if (payload.weddingId !== weddingId) return;
        // The actor already sees their own change optimistically; refetching on
        // the echo would fight the update already on screen.
        if (payload.actorId === userId) return;

        // A bulk import should cost one refresh, not one per row.
        if (burst) clearTimeout(burst);
        burst = setTimeout(() => handler.current(), 150);
      });

      socket.on(PRESENCE_EVENT, (payload: PresencePayload) => {
        if (payload.weddingId !== weddingId) return;
        setViewers(payload.viewers.filter((viewer) => viewer.userId !== userId));
      });
    })();

    // A socket left open in the background gets dropped by the OS and reconnects
    // noisily. Refetching on foreground also covers edits that landed while the
    // phone was asleep and the socket was gone.
    const subscription = AppState.addEventListener("change", (state) => {
      if (!socket) return;
      if (state === "active") {
        if (!socket.connected) socket.connect();
        handler.current();
      } else {
        socket.disconnect();
      }
    });

    return () => {
      cancelled = true;
      if (burst) clearTimeout(burst);
      subscription.remove();
      socket?.close();
      setConnected(false);
      setViewers([]);
    };
  }, [weddingId, userId]);

  return { connected, viewers };
}
