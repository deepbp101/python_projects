import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, clearToken, readToken, writeToken } from "~/api";
import { clearCache } from "~/cache";

export type User = { id: string; email: string; name: string };

type AuthState = {
  user: User | null;
  /** True until the stored token has been checked, so nothing flashes on launch. */
  restoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type AuthResponse = User & { token?: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await readToken();
      if (!token) {
        if (!cancelled) setRestoring(false);
        return;
      }

      try {
        // The token outlives the app process, so it may have been revoked or
        // expired since. /me is the cheapest way to find out.
        const { user: me } = await api<{ user: User | null }>("/api/auth/me");
        if (cancelled) return;
        if (me) {
          setUser(me);
        } else {
          await clearToken();
        }
      } catch {
        // Offline on launch: keep the token and stay signed out for now rather
        // than discarding a session that is probably still good. The next
        // launch with signal will restore it.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const authenticate = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const result = await api<AuthResponse>(path, {
        method: "POST",
        // Explicitly unauthenticated: a stale token must not ride along on a
        // sign-in for a different account.
        token: null,
        body: { ...body, client: "native" },
      });

      if (!result.token) {
        // Only reachable against a server that predates the bearer support.
        throw new Error("That server is too old for this app to sign in to.");
      }

      await writeToken(result.token);
      setUser({ id: result.id, email: result.email, name: result.name });
    },
    [],
  );

  const signIn = useCallback(
    (email: string, password: string) =>
      authenticate("/api/auth/login", { email, password }),
    [authenticate],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      authenticate("/api/auth/signup", { name, email, password }),
    [authenticate],
  );

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // The session row may already be gone, or the phone may be offline. The
      // local token is dropped either way — a sign-out that appears to fail
      // leaves someone holding a phone they think is still signed in.
    }
    await clearToken();
    await clearCache();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, restoring, signIn, signUp, signOut }),
    [user, restoring, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
