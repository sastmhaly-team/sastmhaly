/**
 * High-performance client-side cache with persistent offline storage for instant page navigation (<1s).
 * Implements Stale-While-Revalidate (SWR) behavior with full Offline Fallback.
 * All merchant pages (Dashboard, POS, Sales, Products, Inventory, Accounting, etc.)
 * continue to function seamlessly even when internet connection is lost.
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
}

const cacheStore = new Map<string, CacheEntry>();
const LOCAL_STORAGE_PREFIX = 'sastmhaly_cache_';

export function getCachedData<T = any>(key: string): T | null {
  // 1. Check in-memory store
  const entry = cacheStore.get(key);
  if (entry) return entry.data as T;

  // 2. Check persistent localStorage fallback
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_PREFIX + key);
      if (stored) {
        const parsed = JSON.parse(stored) as CacheEntry<T>;
        // Restore to memory cache
        cacheStore.set(key, parsed);
        return parsed.data;
      }
    } catch (err) {
      console.warn('Error reading persistent cache for key:', key, err);
    }
  }

  return null;
}

export function setCachedData<T = any>(key: string, data: T) {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now()
  };

  // 1. Store in memory
  cacheStore.set(key, entry);

  // 2. Persist to localStorage for full offline availability
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_PREFIX + key, JSON.stringify(entry));
    } catch (err) {
      // If quota exceeded, clear older non-critical cache items
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(LOCAL_STORAGE_PREFIX) && k !== LOCAL_STORAGE_PREFIX + key) {
            localStorage.removeItem(k);
            break;
          }
        }
      } catch {}
    }
  }
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cacheStore.clear();
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(LOCAL_STORAGE_PREFIX)) keysToRemove.push(k);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch {}
    }
    return;
  }

  for (const key of cacheStore.keys()) {
    if (key.includes(prefix)) {
      cacheStore.delete(key);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(LOCAL_STORAGE_PREFIX) && k.includes(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

/**
 * Fetch wrapper that returns cached data immediately if available,
 * and fetches the latest data in the background (Stale-While-Revalidate).
 * If offline or network fails, automatically falls back to persistent cache without throwing!
 */
export async function fetchWithCache<T = any>(
  url: string,
  onData?: (data: T, isFromCache: boolean) => void
): Promise<T> {
  const cached = getCachedData<T>(url);
  if (cached && onData) {
    // Deliver instantly from persistent/in-memory cache
    onData(cached, true);
  }

  // If browser is currently offline, return cached data immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (cached) return cached;
    return {} as T;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (cached) {
        console.warn(`[Offline Cache Fallback] Fetch failed for ${url} with status ${res.status}, using cached data.`);
        return cached;
      }
      throw new Error(`Fetch failed with status ${res.status}`);
    }

    const freshData = await res.json();
    setCachedData(url, freshData);
    if (onData) {
      onData(freshData, false);
    }
    return freshData;
  } catch (networkError) {
    if (cached) {
      console.warn(`[Offline Cache Fallback] Network unavailable for ${url}, continuing offline with cached data.`);
      return cached;
    }
    console.error(`[Cache Error] Failed to fetch and no cached data available for ${url}:`, networkError);
    return {} as T;
  }
}
