import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {IVSubscriber, SubscriberSchema} from "../schema/subscriber"

export class SubscriberRepository {
  constructor(private readonly env: LmdbEnvSub<typeof SubscriberSchema>) {}

  async subscribe(id: number, data: Omit<IVSubscriber, `id` | `joinedAt`>): Promise<{subscriber: IVSubscriber; created: boolean}> {
    return this.env.owner.transaction(async (tx) => {
      const existing = this.env.get(id, tx)
      if (existing) {
        const updated: IVSubscriber = {
          id,
          joinedAt: existing.joinedAt ?? Date.now(),
          userName: data.userName ?? existing.userName,
          fullName: data.fullName ?? existing.fullName,
          language: data.language ?? existing.language
        }
        await this.env.put(id, updated, tx)
        return {subscriber: updated, created: false}
      }

      const now = Date.now()
      const subscriber: IVSubscriber = {id, joinedAt: now, ...data}
      await this.env.put(id, subscriber, tx)
      return {subscriber, created: true}
    })
  }

  async unsubscribe(id: number): Promise<boolean> {
    return this.env.delete(id)
  }

  async isSubscribed(id: number): Promise<boolean> {
    return this.env.has(id)
  }

  async total(): Promise<number> {
    return this.env.count()
  }

  async list(): Promise<IVSubscriber[]> {
    const entries = await this.env.entries()
    return entries.map(([, v]) => v).sort((a, b) => a.joinedAt - b.joinedAt)
  }
}
