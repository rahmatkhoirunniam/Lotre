/**
 * Lightweight in-memory TTL cache for Next.js API routes.
 *
 * Designed for single-server deployments (SQLite / local Prisma).
 * Eliminates redundant DB queries on rapid sequential requests.
 *
 * Usage:
 *   import { apiCache } from "@/lib/cache";
 *
 *   // Read (returns null on miss / expired)
 *   const cached = apiCache.get<MyType>("some:key");
 *
 *   // Write with 30-second TTL
 *   apiCache.set("some:key", data, 30_000);
 *
 *   // Invalidate on mutation
 *   apiCache.invalidate("some:key");
 *   apiCache.invalidatePattern("members:"); // all keys starting with prefix
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /** Retrieve a value. Returns null if missing or expired. */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  /** Store a value with a TTL in milliseconds (default: 30s). */
  set<T>(key: string, value: T, ttlMs = 30_000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Remove a specific cache entry. */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Remove all cache entries whose key starts with the given prefix.
   * Useful for invalidating all members:* when adding a member.
   */
  invalidatePattern(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Remove all entries (useful in tests). */
  clear(): void {
    this.store.clear();
  }

  /** Number of live (non-expired) entries. */
  get size(): number {
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }
}

// Singleton — persists across hot-reloads in Next.js dev via module cache
// In production this lives for the lifetime of the Node.js process.
declare global {
  // eslint-disable-next-line no-var
  var __apiCache: TTLCache | undefined;
}

export const apiCache: TTLCache =
  globalThis.__apiCache ?? (globalThis.__apiCache = new TTLCache());
