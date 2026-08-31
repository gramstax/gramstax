import type { LmdbEnvSub } from "@gramstax/lmdb"
import type { UserSchema } from "../schema/user"

export class UserRepository {
  constructor(private env: LmdbEnvSub<typeof UserSchema>) {}

  async findOrCreate(
    tgId: number,
    data: {
      username: string
      firstName: string
      lastName: string
      languageCode: string
    }
  ) {
    return this.env.owner.transaction(async () => {
      const existing = this.env.get(tgId)
      if (existing) {
        const updated = {...existing, ...data, updatedAt: Date.now()}
        await this.env.put(tgId, updated)
        return {user: updated, created: false}
      }
      const now = Date.now()
      const user = {tgId, ...data, createdAt: now, updatedAt: now}
      await this.env.put(tgId, user)
      return {user, created: true}
    })
  }

  async touch(tgId: number) {
    return this.env.owner.transaction(async () => {
      const user = this.env.get(tgId)
      if (user) {
        await this.env.put(tgId, {...user, updatedAt: Date.now()})
      }
    })
  }

  async displayName(tgId: number) {
    const user = this.env.get(tgId)
    if (!user) return `User#${tgId}`
    return user.firstName || user.username || `User#${tgId}`
  }
}
