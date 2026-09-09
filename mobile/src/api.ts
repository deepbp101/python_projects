import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * The API client.
 *
 * Same 65 routes the web app talks to; the only difference is that the session
 * token rides in an Authorization header instead of a cookie, because a phone
 * has no cookie jar shared with fetch. The server accepts either.
 */

/**
 * Where the backend lives.
 *
 * EXPO_PUBLIC_API_URL wins, because that is what an EAS build profile sets —
 * a development build points at a laptop on the LAN, a production build at the
 * deployed server, and neither should mean editing a checked-in file. The
 * `extra.apiUrl` in app.json is the fallback for `npx expo start` locally.
 *
 * Public by nature: it is baked into the bundle and anyone can read it. That is
 * fine — it is a hostname, not a secret. Nothing secret is ever put here.
 */
export const API_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  "http://localhost:3000";

const TOKEN_KEY = "wp_session_token";

/**
 * On a device the token lives in the keychain, not AsyncStorage.
 *
 * AsyncStorage is a plain unencrypted file — readable on a rooted or jailbroken
 * device, and swept up in a filesystem backup. A session token is a password
 * with a thirty-day life, so it goes where passwords go. Everything else the
 * app caches is workspace data the user already has, and that does live in
 * AsyncStorage.
 *
 * `expo-secure-store` has no web implementation, and calling it under
 * `expo start --web` throws. Web here is a development preview only — the
 * shipped web product is the Next.js app next door, which uses an httpOnly
 * cookie and never touches this — so the fallback is localStorage, which is
 * fine for a preview and would not be acceptable for anything shipped.
 */
const onWeb = Platform.OS === "web";

export async function readToken(): Promise<string | null> {
  if (onWeb) return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function writeToken(token: string): Promise<void> {
  if (onWeb) {
    globalThis.localStorage?.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    // Available whenever the device has been unlocked once since boot, so a
    // background refresh does not fail on a locked phone, and never migrated
    // to a new device in a backup.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}

export async function clearToken(): Promise<void> {
  if (onWeb) {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Thrown when the request never reached the server, as distinct from a 4xx. */
export class OfflineError extends Error {
  constructor() {
    super("Can't reach the planner right now.");
    this.name = "OfflineError";
  }
}

type Options = {
  method?: string;
  body?: unknown;
  /** Overrides the stored token — used by login, which has one in hand. */
  token?: string | null;
  signal?: AbortSignal;
};

export async function api<T = unknown>(
  path: string,
  options: Options = {},
): Promise<T> {
  const token = options.token !== undefined ? options.token : await readToken();

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    // fetch only rejects when the request did not complete — DNS, no route,
    // connection refused. A 500 is a resolved promise, so this branch really is
    // "the phone could not reach the server", which callers handle by falling
    // back to cache rather than by showing an error.
    throw new OfflineError();
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      (payload as { error?: string } | null)?.error ??
        "Something went wrong. Please try again.",
      (payload as { details?: unknown } | null)?.details,
    );
  }

  return payload as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or captive portal answering with HTML should read as a reachability
    // problem, not as a crash inside JSON.parse.
    throw new OfflineError();
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof OfflineError) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
