import {LmdbEnvSub, LmdbSchema, t} from "@gramstax/lmdb"
import type {KeyOf, ValueOf} from "@gramstax/lmdb"

export class UserSchema extends LmdbSchema {
  static db = `user`
  static key = t.number()
  static value = {
    tgId: t.number(),
    username: t.string(),
    firstName: t.string(),
    lastName: t.string(),
    languageCode: t.string(),
    createdAt: t.number(),
    updatedAt: t.number()
  }
}

export type IKUser = KeyOf<typeof UserSchema>
export type IVUser = ValueOf<typeof UserSchema>

export class UserService {
  constructor(private users: LmdbEnvSub<typeof UserSchema>) {}

  async findOrCreate(
    tgId: number,
    data: {
      username: string
      firstName: string
      lastName: string
      languageCode: string
    }
  ): Promise<{user: IVUser; created: boolean}> {
    return this.users.owner.transaction(async () => {
      const existing = this.users.get(tgId)
      if (existing) {
        const updated: IVUser = {...existing, ...data, updatedAt: Date.now()}
        await this.users.put(tgId, updated)
        return {user: updated, created: false}
      }
      const now = Date.now()
      const user: IVUser = {tgId, ...data, createdAt: now, updatedAt: now}
      await this.users.put(tgId, user)
      return {user, created: true}
    })
  }

  async touch(tgId: number) {
    return this.users.owner.transaction(async () => {
      const user = this.users.get(tgId)
      if (user) {
        await this.users.put(tgId, {...user, updatedAt: Date.now()})
      }
    })
  }

  async displayName(tgId: number): Promise<string> {
    const user = this.users.get(tgId)
    if (!user) return `User#${tgId}`
    return user.firstName || user.username || `User#${tgId}`
  }
}
