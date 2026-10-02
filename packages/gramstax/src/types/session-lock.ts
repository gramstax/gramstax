import type {Ctx} from "~/core/ctx"

/**
 * Minimal Redis client surface used by `SessionLock`.
 *
 * @remarks
 * Structurally compatible with the official `@redis/client` (`RedisClientType`)
 * that backs the `@keyv/redis` store — only `set` (with `NX`/`PX`) and `eval`
 * are required. Keeping a minimal structural type decouples the lock from
 * concrete Redis client versions.
 *
 * @public
 */
export type IRedisLockClient = {
  /**
   * Atomically set a lease key when absent.
   *
   * @remarks
   * Called with `{PX: leaseMs, NX: true}` so the lease auto-expires and is
   * only set when no competing instance holds it. Resolves to a truthy
   * reply on acquisition, `null` when the key is already held.
   */
  set(key: string, value: string, options?: {PX?: number; NX?: boolean}): Promise<string | null>
  /**
   * Run the owned-release Lua script.
   *
   * @remarks
   * Deletes the lease key only when the stored token matches, so a slow
   * holder can never release a successors lease after its own expiry.
   */
  eval(script: string, options: {keys: string[]; arguments: string[]}): Promise<unknown>
}

/**
 * Contention policy when the session lease cannot be acquired.
 *
 * @remarks
 * - `skip` — drop the contended update (`withLock` resolves `null`).
 * - `wait` — retry every `10ms` until `leaseMs` elapses, then give up with `null`.
 * - `serialize` — queue per session key so contended updates run in order.
 *
 * @public
 */
export type ISessionLockOnContended = `skip` | `wait` | `serialize`

/**
 * Configuration for the distributed session lock.
 *
 * @remarks
 * Redis-only: the lock uses atomic `SET NX PX` leases on the session key so
 * concurrent updates for the same user/chat are serialized or skipped across
 * instances. When the bots cache is NOT Redis-backed, the feature is
 * auto-disabled with a warning (single-instance deployments do not need it).
 *
 * @public
 */
export type ISessionLockOptions = {
  /**
   * Explicitly disable the lock.
   *
   * @remarks
   * `false` turns locking off even when other fields are set. Omitted means
   * enabled when the option object is present.
   *
   * @defaultValue `true`
   */
  enabled?: boolean
  /**
   * Lock lease duration in milliseconds.
   *
   * @remarks
   * The `PX` expiry on the `SET NX` lease and the retry budget for the
   * `wait` contention policy. A crashed instance stops holding the session
   * once this elapses.
   *
   * @defaultValue `5000`
   */
  leaseMs?: number
  /**
   * Behavior when the lease is contended.
   *
   * @remarks
   * `skip` drops the update, `wait` retries until the lease frees,
   * `serialize` queues per session key.
   *
   * @defaultValue `skip`
   */
  onContended?: ISessionLockOnContended
  /**
   * Custom lock key from the page context.
   *
   * @remarks
   * Receives the full page `Ctx` and must return the session key to lock.
   * Defaults to `ctx.sessionKey()`, namespaced internally as `lock:<key>`.
   */
  key?: (ctx: Ctx) => string
}
