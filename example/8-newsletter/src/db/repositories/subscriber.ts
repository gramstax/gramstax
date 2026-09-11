import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {IVSubscriber, SubscriberSchema} from "../schema/subscriber"

export class SubscriberRepository {
  constructor(private readonly env: LmdbEnvSub<typeof SubscriberSchema>) {}

  async subscribe(id: number, data: Omit<IVSubscriber, `id` | `joinedAt`>): Promise<{subscriber: IVSubscriber; created: boolean}> {
    const subscriber = {id, joinedAt: Date.now(), ...data}
    const status = await this.env.putIfNotExists(id, subscriber)
    return {subscriber, created: status}
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
