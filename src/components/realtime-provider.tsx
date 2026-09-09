"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  PRESENCE_EVENT,
  WORKSPACE_EVENT,
  type PresencePayload,
  type WorkspaceChangedPayload,
} from "@/lib/realtime/events";

type RealtimeState = {
  connected: boolean;
  viewers: { userId: string; name: string }[];
};

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  viewers: [],
});

export const useRealtime = () => useContext(RealtimeContext);

/**
 * Keeps the page in sync with other collaborators.
 *
 * The server only says *what* changed; this refreshes the server components so
 * the new data comes from the same place a fresh page load would get it. That
 * avoids maintaining a parallel client-side cache that can drift.
 */
export function RealtimeProvider({
  weddingId,
  userId,
  children,
}: {
  weddingId: string;
  userId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState<{ userId: string; name: string }[]>([]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket: Socket = io({ path: "/api/socket" });

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join", weddingId);
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on(WORKSPACE_EVENT, (payload: WorkspaceChangedPayload) => {
      if (payload.weddingId !== weddingId) return;
      // The actor already sees their own change optimistically.
      if (payload.actorId === userId) return;

      // A burst of edits (a bulk import, say) should cost one refresh, not one
      // per row.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 150);
    });

    socket.on(PRESENCE_EVENT, (payload: PresencePayload) => {
      if (payload.weddingId !== weddingId) return;
      setViewers(payload.viewers.filter((viewer) => viewer.userId !== userId));
    });

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      socket.emit("leave", weddingId);
      socket.disconnect();
    };
  }, [weddingId, userId, router]);

  const value = useMemo(
    () => ({ connected, viewers }),
    [connected, viewers],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

/** Small "who else is here" indicator for the workspace header. */
export function PresenceBar() {
  const { connected, viewers } = useRealtime();

  return (
    <div className="flex items-center gap-2 text-xs text-ink-faint">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-sage" : "bg-line-strong"}`}
      />
      <span>
        {!connected
          ? "Offline"
          : viewers.length === 0
            ? "Live"
            : `${viewers.map((v) => v.name.split(" ")[0]).join(", ")} also here`}
      </span>
    </div>
  );
}
