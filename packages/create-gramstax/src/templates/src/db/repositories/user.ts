import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {UserSchema, IVUser} from "../schema/user"

export type IUserProfile = Pick<IVUser, `username` | `firstName` | `lastName` | `languageCode`>

export class UserRepository {
  constructor(private readonly _user: LmdbEnvSub<typeof UserSchema>) {}

  /**
   * Insert once, keyed by Telegram id.
   *
   * `putIfNotExists` reports whether *this* call won the write, so the loser
   * path reads the row back. Returning the object we just failed to write would
   * hand callers a row that was never stored.
   */
  async createIfNotExists(tgId: number, data: IUserProfile): Promise<{user: IVUser; created: boolean}> {
    const fresh = {...data, updatedAt: new Date()} as IVUser
    const created = await this._user.putIfNotExists(tgId, fresh)
    if (created) return {user: fresh, created}
    return {user: this._user.get(tgId) ?? fresh, created}
  }

  /**
   * Bump `updatedAt` on an existing row.
   *
   * Read-then-write, so it runs inside a transaction — without one a concurrent
   * writer can land between the read and the write and get silently clobbered.
   */
  async touch(tgId: number): Promise<boolean> {
    return this._user.owner.transaction(() => {
      const row = this._user.get(tgId)
      if (!row) return false
      this._user.putSync(tgId, {...row, updatedAt: new Date()})
      return true
    })
  }

  /** Sync read — LMDB point lookups are synchronous, no promise needed. */
  find(tgId: number): IVUser | undefined {
    return this._user.get(tgId)
  }

  /** Total stored users — O(1) via `mdb_stat`, safe on a hot path. */
  count(): number {
    return this._user.count()
  }

  displayName(tgId: number): string {
    const row = this._user.get(tgId)
    if (!row) return `User#${tgId}`
    return row.firstName || row.username || `User#${tgId}`
  }
}
