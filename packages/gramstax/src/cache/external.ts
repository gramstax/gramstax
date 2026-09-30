import KeyvRedis from "@keyv/redis"
import {Keyv} from "keyv"

type IMore = Omit<Required<ConstructorParameters<typeof Keyv>>[0], `store` | `namespace` | `ttl`> & {forceStore?: unknown | Record<string, unknown>}

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
  url: string

  /**
   * Creates a new CacheExternal instance.
   *
   * @param url - Storage connection URL. Use `"memory"` for in-memory storage or `"redis://..."` for Redis.
   * @param ttl - Default time-to-live in milliseconds. Applies to all keys unless overridden per operation.
   * @param namespace - Key namespace prefix. Isolates keys by namespace.
   * @param more - Additional Keyv options. Use `forceStore` to override automatic store selection.
   */
  constructor(url: string = `memory`, ttl?: number, namespace?: string, more?: IMore) {
    let store: unknown
    if (more?.forceStore !== undefined && more?.forceStore !== null) {
      store = more.forceStore
    } else if (url === `memory`) {
      store = new Map()
    } else if (url.startsWith(`redis`)) {
      store = new KeyvRedis(url)
    } else {
      throw new Error(`Unsupported cache storage URL "${url}". Use "memory", a "redis://..." URL, or pass more.forceStore.`)
    }
    super({store: store as never, namespace, ttl, throwOnErrors: true})
    this.url = url
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
  async refreshLruCache(maxLength?: number): Promise<void> {
    const store: unknown = this.store
    if (!(store instanceof Map)) {
      return
    }
    const keys = Array.from(store.keys())
    const nsLen = this.opts.namespace ? this.opts.namespace.length + 1 : 0
    const limit = maxLength ?? keys.length
    for (let i = 0; i < keys.length && i < limit; i++) {
      const k = String(keys[i])
      await this.get(nsLen ? k.slice(nsLen) : k)
    }
  }
}
