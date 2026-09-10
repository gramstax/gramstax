import type { LmdbEnvSub } from "@gramstax/lmdb"
import type { UserSchema } from "../schema/user"

export class UserRepository {
  constructor(private env: LmdbEnvSub<typeof UserSchema>) {}

  async createIfNotExists(
    tgId: number,
    data: {
      username: string
      firstName: string
      lastName: string
      languageCode: string
    }
  ) {
    const now = Date.now()
    const fresh = {tgId, ...data, createdAt: now, updatedAt: now}
    await this.env.putIfNotExists(tgId, fresh)
    return {user: fresh, created: true}
  }

  async displayName(tgId: number) {
    const user = this.env.get(tgId)
    if (!user) {
      return `User#${tgId}`
    }
    return user.firstName || user.username || `User#${tgId}`
  }
}
