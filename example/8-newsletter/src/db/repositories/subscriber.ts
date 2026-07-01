import {LmdbRepository} from "@gramstax/lmdb"

export type IVSubscriber = {
  id: number
  userName?: string
  fullName?: string
  language?: string
  joinedAt: number
}

export class SubscriberRepository extends LmdbRepository<IVSubscriber, number> {
  static dbName = `subscribers`

  async subscribe(id: number, data: Omit<IVSubscriber, `id` | `joinedAt`>): Promise<{subscriber: IVSubscriber; created: boolean}> {
    return this._env.transaction(async () => {
      const existing = await this.get(id)
      if (existing) {
        const updated: IVSubscriber = {...existing, ...data, id}
        await this.set(id, updated)
        return {subscriber: updated, created: false}
      }

      const now = Date.now()
      const subscriber: IVSubscriber = {id, joinedAt: now, ...data}
      await this.set(id, subscriber)
      return {subscriber, created: true}
    })
  }

  async unsubscribe(id: number): Promise<boolean> {
    return this.delete(id)
  }

  async isSubscribed(id: number): Promise<boolean> {
    return this.has(id)
  }

  async total(): Promise<number> {
    return this.count()
  }

  async list(): Promise<IVSubscriber[]> {
    const entries = await this.entries()
    return entries.map(([_, v]) => v).sort((a, b) => a.joinedAt - b.joinedAt)
  }
}
