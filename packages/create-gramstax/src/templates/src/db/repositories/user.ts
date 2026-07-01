import {LmdbRepository} from "@gramstax/lmdb"

export type IKUser = number

export type IVUser = {
  tgId: number
  username: string
  firstName: string
  lastName: string
  languageCode: string
  createdAt: number
  updatedAt: number
}

export class UserRepo extends LmdbRepository<IVUser, IKUser> {
  static dbName = `user`

  async findOrCreate(tgId: number, data: {username: string; firstName: string; lastName: string; languageCode: string}): Promise<{user: IVUser; created: boolean}> {
    return this.env.transaction(async () => {
      const existing = await this.get(tgId)
      if (existing) {
        const updated: IVUser = {...existing, ...data, updatedAt: Date.now()}
        await this.set(tgId, updated)
        return {user: updated, created: false}
      }
      const now = Date.now()
      const user: IVUser = {tgId, ...data, createdAt: now, updatedAt: now}
      await this.set(tgId, user)
      return {user, created: true}
    })
  }

  async touch(tgId: number) {
    return this.env.transaction(async () => {
      const user = await this.get(tgId)
      if (user) {
        await this.set(tgId, {...user, updatedAt: Date.now()})
      }
    })
  }

  async displayName(tgId: number): Promise<string> {
    const user = await this.get(tgId)
    if (!user) return `User#${tgId}`
    return user.firstName || user.username || `User#${tgId}`
  }
}
