/**
 * External cache adapter — wraps `keyv` for Redis/Keyv-backed caching.
 *
 * @remarks
 * Provides a unified cache interface using the `keyv` library with optional
 * Redis backend via `@keyv/redis`. Used internally by the bot for session
 * and state storage.
 *
 * @public
 */

import KeyvRedis from "@keyv/redis"
import {Keyv} from "keyv"

type ITMore = Omit<Required<ConstructorParameters<typeof Keyv>>[0], `store` | `namespace` | `ttl`> & {forceStore?: unknown | Record<string, unknown>}

/**
 * RPC cache request structure.
 * @public
 */
export type ITCacheRpc = {method: string | string[]; params: Record<string, unknown>; [moreRoot: string]: unknown | string}

/**
 * Extends {@link https://github.com/jaredwray/keyv | Keyv} to provide a unified caching interface
 * with built-in support for memory and Redis storage.
 *
 * @remarks
 * Storage modes:
 * - **Memory mode:** when `url` is `"memory"` (default), uses an in-memory `Map`.
 * - **Redis mode:** when `url` starts with `"redis"`, uses `@keyv/redis` adapter.
 * - **Custom mode:** when `more.forceStore` is provided, uses the custom store.
 *
 * @typeParam V - The type of values stored in the cache.
 *
 * @example
 * ```typescript
 * import { CacheExternal } from "gramstax";
 *
 * // Memory cache (default)
 * const memoryCache = new CacheExternal();
 *
 * // Redis cache
 * const redisCache = new CacheExternal("redis://localhost:6379", 3600000, "s");
 *
 * // With namespace and TTL
 * const cache = new CacheExternal("memory", 60000, "myapp");
 *
 * // Set and get data
 * await cache.set("user:123", { name: "John" });
 * const user = await cache.get("user:123");
 * ```
 *
 * @public
 */
export class CacheExternal<V = unknown> extends Keyv<V> {
  /**
   * Creates a new CacheExternal instance.
   *
   * @param url - Storage connection URL. Use `"memory"` for in-memory storage or `"redis://..."` for Redis.
   * @param ttl - Default time-to-live in milliseconds. Applies to all keys unless overridden per operation.
   * @param namespace - Key namespace prefix. Isolates keys by namespace.
   * @param more - Additional Keyv options. Use `forceStore` to override automatic store selection.
   */
  constructor(
    public url: string = `memory`,
    ttl?: number,
    namespace?: string,
    more?: ITMore
  ) {
    let store: Map<unknown, unknown> | KeyvRedis<unknown> | unknown = {}
    if (url.startsWith(`redis`)) store = new KeyvRedis(url)
    if (url === `memory`) store = new Map()
    if (more?.forceStore) store = more.forceStore

    super({store, namespace, ttl})
  }

  /**
   * Refreshes the LRU cache by re-accessing keys in order.
   *
   * @remarks
   * This method iterates through the store keys and calls `get()` on each to refresh the LRU order.
   * Only applicable for memory-based stores using `Map`.
   *
   * @param maxLength - Maximum number of keys to refresh. If omitted, refreshes all keys.
   *
   * @example
   * ```typescript
   * const cache = new CacheExternal("memory", 60000, "app");
   *
   * // Refresh all keys
   * cache.refreshLruCache();
   *
   * // Refresh only the first 100 keys
   * cache.refreshLruCache(100);
   * ```
   * @public
   */
  refreshLruCache(maxLength?: number) {
    const store = this.store as Map<unknown, unknown>
    const nsLen = this.opts.namespace ? this.opts.namespace?.length + 1 : null
    const keys = store.keys().toArray()
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i] as string
      if (i === maxLength) {
        return
      }
      this.get(nsLen ? k.slice(nsLen) : k)
    }
  }
}
