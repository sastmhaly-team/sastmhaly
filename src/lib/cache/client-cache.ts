/**
 * High-performance client-side in-memory cache for instant page navigation (<1s).
 * Implements Stale-While-Revalidate (SWR) behavior so returning to any page is instantaneous
 * without blank screens or loading spinners, while revalidating data in background.
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry>();

export function getCachedData<T = any>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  return entry.data as T;
}

export function setCachedData<T = any>(key: string, data: T) {
  cacheStore.set(key, {
    data,
    timestamp: Date.now()
  });
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.includes(prefix)) {
      cacheStore.delete(key);
    }
  }
}

/**
 * Fetch wrapper that returns cached data immediately if available,
 * and fetches the latest data in the background (Stale-While-Revalidate).
 */
export async function fetchWithCache<T = any>(
  url: string,
  onData?: (data: T, isFromCache: boolean) => void
): Promise<T> {
  const cached = getCachedData<T>(url);
  if (cached && onData) {
    // Deliver instantly from cache
    onData(cached, true);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Fetch failed with status ${res.status}`);
  }
  const freshData = await res.json();
  setCachedData(url, freshData);
  if (onData) {
    onData(freshData, false);
  }
  return freshData;
}
