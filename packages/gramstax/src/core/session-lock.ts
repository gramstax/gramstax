import {randomUUID} from "node:crypto"
import type {IRedisLockClient, ISessionLockOnContended} from "~/types/session-lock"

const RELEASE_SCRIPT = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`

/**
 * Distributed session lock using atomic Redis leases.
 *
 * @remarks
 * Acquires a `SET NX PX` lease on the session key (auto-expiring after
 * `leaseMs`) so concurrent updates for the same user/chat are serialized or
 * skipped across instances. Release is atomic via Lua (owned-release).
 *
 * @public
 */
export class SessionLock {
  _queues = new Map<string, Promise<unknown>>()

  constructor(
    public redis: IRedisLockClient,
    public options: {leaseMs: number; onContended: ISessionLockOnContended}
  ) {}

  _lockKey(sessionKey: string): string {
    return `lock:${sessionKey}`
  }

  /**
   * Try to acquire a lease for the given session key.
   *
   * @param sessionKey - The session key to lock.
   * @returns A token string on success, or `null` if the key is already held.
   *
   * @public
   */
  async acquire(sessionKey: string): Promise<string | null> {
    const token = randomUUID()
    const ok = await this.redis.set(this._lockKey(sessionKey), token, {PX: this.options.leaseMs, NX: true})
    return ok ? token : null
  }

  /**
   * Release a lease. Atomic Lua — only deletes when the stored token matches.
   *
   * @param sessionKey - The session key to unlock.
   * @param token - The token returned by `acquire`.
   *
   * @public
   */
  async release(sessionKey: string, token: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, {keys: [this._lockKey(sessionKey)], arguments: [token]})
  }

  /**
   * Acquire a lease, run `fn`, and release.
   *
   * @param sessionKey - The session key to lock.
   * @param fn - The work to perform under the lock.
   * @returns The return value of `fn`, or `null` when the lock could not be
   *   acquired and the contention policy is `skip`.
   *
   * @public
   */
  async withLock<T>(sessionKey: string, fn: () => Promise<T>): Promise<T | null> {
    if (this.options.onContended === `serialize`) {
      const prev = this._queues.get(sessionKey) ?? Promise.resolve()
      const run = prev.then(async () => {
        const token = await this.acquire(sessionKey)
        if (!token) return null
        try {
          return await fn()
        } finally {
          await this.release(sessionKey, token)
        }
      })
      const tracked = run.catch(() => undefined)
      this._queues.set(sessionKey, tracked)
      void tracked.finally(() => {
        if (this._queues.get(sessionKey) === tracked) this._queues.delete(sessionKey)
      })
      return run
    }

    const deadline = Date.now() + this.options.leaseMs
    for (;;) {
      const token = await this.acquire(sessionKey)
      if (token) {
        try {
          return await fn()
        } finally {
          await this.release(sessionKey, token)
        }
      }
      if (this.options.onContended === `wait` && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        continue
      }
      return null
    }
  }
}
