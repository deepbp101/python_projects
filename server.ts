/**
 * Custom Next.js server that also hosts Socket.IO.
 *
 * Next's own `next start` cannot hold long-lived WebSocket connections, and
 * live collaboration is a core requirement, so the two share one HTTP server.
 * Run with `npm run dev` / `npm start` — both go through this file.
 */
// Loaded first: modules below read DATABASE_URL and AUTH_SECRET at import time,
// before Next gets a chance to load .env itself.
import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
// Only Next-free modules below this line: see src/lib/auth/constants.ts.
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { setRealtimeServer } from "@/lib/realtime/emit";
import {
  PRESENCE_EVENT,
  weddingRoom,
  type PresencePayload,
} from "@/lib/realtime/events";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const hostname = process.env.HOSTNAME ?? "localhost";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

type SocketUser = { id: string; name: string };

/**
 * Resolves the socket's user from either delivery mechanism.
 *
 * The browser hands its session over automatically in the handshake cookie
 * header. The native app has no cookie to send, so it puts the same token in
 * `auth` when it connects: `io(url, { auth: { token } })`.
 */
async function authenticate(
  cookieHeader?: string,
  handshakeToken?: unknown,
): Promise<SocketUser | null> {
  const token =
    (typeof handshakeToken === "string" && handshakeToken.length > 0
      ? handshakeToken
      : null) ?? readCookie(cookieHeader, SESSION_COOKIE);
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true } } },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session.user;
}

/** Rebuilds and broadcasts who is currently viewing a wedding. */
async function broadcastPresence(io: Server, weddingId: string) {
  const sockets = await io.in(weddingRoom(weddingId)).fetchSockets();
  const seen = new Map<string, string>();
  for (const socket of sockets) {
    const user = socket.data.user as SocketUser | undefined;
    if (user) seen.set(user.id, user.name);
  }
  const payload: PresencePayload = {
    weddingId,
    viewers: [...seen].map(([userId, name]) => ({ userId, name })),
  };
  io.to(weddingRoom(weddingId)).emit(PRESENCE_EVENT, payload);
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  /**
   * Rooms live in this process's memory.
   *
   * That is the one thing tying the app to a single machine, and it is a
   * deliberate trade rather than an oversight: one machine is comfortably
   * enough for a wedding, and the Redis an adapter needs would be the only
   * piece of infrastructure here that exists purely to support scaling.
   *
   * Everything else already survives more than one process — rate limits are
   * counted in Postgres, sessions are database rows, and the only module-level
   * caches are memoised SDK clients that are meant to be per-process.
   *
   * So if this ever needs a second machine, the whole change is
   * `@socket.io/redis-adapter` here plus a Redis URL; nothing above this line
   * moves. Without it, two collaborators can be in the "same" room on different
   * machines and never see each other's edits — which fails silently, looking
   * like realtime that just stopped working.
   */
  const io = new Server(httpServer, {
    path: "/api/socket",
    // Same-origin only: the browser sends the session cookie automatically.
    // The native app has no cookie and no Origin header, so this does not
    // affect it — see `authenticate` above.
    cors: { origin: false },
  });

  io.use(async (socket, nextFn) => {
    try {
      const user = await authenticate(
        socket.handshake.headers.cookie,
        socket.handshake.auth?.token,
      );
      if (!user) return nextFn(new Error("unauthorized"));
      socket.data.user = user;
      nextFn();
    } catch (error) {
      console.error("Socket auth failed:", error);
      nextFn(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as SocketUser;

    // Membership is re-checked here rather than trusted from the client, so a
    // socket cannot subscribe to a wedding the user was never invited to.
    socket.on("join", async (weddingId: string) => {
      const membership = await prisma.collaborator.findFirst({
        where: { weddingId, userId: user.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (!membership) return;

      await socket.join(weddingRoom(weddingId));
      socket.data.weddingIds = [
        ...new Set([...(socket.data.weddingIds ?? []), weddingId]),
      ];
      await broadcastPresence(io, weddingId);
    });

    socket.on("leave", async (weddingId: string) => {
      await socket.leave(weddingRoom(weddingId));
      socket.data.weddingIds = (socket.data.weddingIds ?? []).filter(
        (id: string) => id !== weddingId,
      );
      await broadcastPresence(io, weddingId);
    });

    socket.on("disconnecting", () => {
      const weddingIds: string[] = socket.data.weddingIds ?? [];
      // Runs after the socket has actually left its rooms.
      setImmediate(() => {
        for (const weddingId of weddingIds) {
          void broadcastPresence(io, weddingId);
        }
      });
    });
  });

  // Hand the instance to the route handlers, which broadcast after mutations.
  setRealtimeServer(io);

  httpServer.listen(port, () => {
    console.log(
      `> Wedding planner ready on http://${hostname}:${port} (${dev ? "development" : "production"})`,
    );
  });
});
