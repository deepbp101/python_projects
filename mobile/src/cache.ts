import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, OfflineError } from "~/api";

/**
 * Read-through cache for GET payloads.
 *
 * The point is what a couple sees when they open the app at a venue with one
 * bar of signal: the numbers they had last time, marked stale, rather than a
 * spinner over nothing. Writes are never queued — a task ticked offline that
 * silently fails to send later is worse than one that refuses now and says so.
 */

const PREFIX = "wp_cache:";

type Entry<T> = { at: number; data: T };

async function readCache<T>(key: string): Promise<Entry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as Entry<T>) : null;
  } catch {
    // A corrupt or unreadable entry is a cache miss, never a crash on launch.
    return null;
  }
}

async function writeCache<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PREFIX + key,
      JSON.stringify({ at: Date.now(), data } satisfies Entry<T>),
    );
  } catch {
    // Out of disk, most likely. Losing the cache is survivable; failing the
    // request that just succeeded is not.
  }
}

/** Drops every cached payload. Called on sign-out so the next user sees none of it. */
export async function clearCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((key) => key.startsWith(PREFIX));
  if (ours.length > 0) await AsyncStorage.multiRemove(ours);
}

export type Loaded<T> = {
  data: T | null;
  /** When the data on screen was fetched, or null if it has never loaded. */
  fetchedAt: number | null;
  /** True while showing cached data because the network could not be reached. */
  stale: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Fetches `path`, showing cached content immediately if there is any.
 *
 * `key` defaults to the path, which is right for everything here; it is
 * separate so two screens reading the same endpoint with different query
 * strings can still share one cache entry when that is what you want.
 */
export function useCached<T>(
  path: string | null,
  options: { key?: string } = {},
): Loaded<T> {
  const key = options.key ?? path ?? "";
  const [data, setData] = useState<T | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow response from a previous path landing after the
  // screen has moved on to another wedding.
  const active = useRef(0);

  const load = useCallback(
    async (isRefresh: boolean) => {
      if (!path) return;
      const generation = ++active.current;

      if (isRefresh) setRefreshing(true);
      setError(null);

      // Show whatever was there before the network is even attempted, so the
      // first frame after launch has content on it.
      if (!isRefresh) {
        const cached = await readCache<T>(key);
        if (cached && generation === active.current) {
          setData(cached.data);
          setFetchedAt(cached.at);
          setLoading(false);
        }
      }

      try {
        const fresh = await api<T>(path);
        if (generation !== active.current) return;
        setData(fresh);
        setFetchedAt(Date.now());
        setStale(false);
        await writeCache(key, fresh);
      } catch (caught) {
        if (generation !== active.current) return;
        if (caught instanceof OfflineError) {
          const cached = await readCache<T>(key);
          if (cached) {
            // Offline with something to show: keep it, and say it is old.
            setData(cached.data);
            setFetchedAt(cached.at);
            setStale(true);
          } else {
            setError(caught.message);
          }
        } else {
          setError(
            caught instanceof Error
              ? caught.message
              : "Something went wrong. Please try again.",
          );
        }
      } finally {
        if (generation === active.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path, key],
  );

  useEffect(() => {
    void load(false);
    return () => {
      // Invalidate in-flight loads when the path changes or the screen unmounts.
      active.current += 1;
    };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, fetchedAt, stale, loading, refreshing, error, refresh };
}
