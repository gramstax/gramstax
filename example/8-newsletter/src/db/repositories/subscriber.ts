import {type LmdbEnvSub, LmdbSchema, t} from "@gramstax/lmdb"
import type {ValueOf} from "@gramstax/lmdb"

export type IKSubscriber = number
export type IVSubscriber = {
  id: number
  userName?: string
  fullName?: string
  language?: string
  joinedAt: number
}

export class SubscriberSchema extends LmdbSchema {
  static db = `subscribers`
  static key = t.number()
  static value = {
    id: t.number(),
    userName: t.string().nullable(),
    fullName: t.string().nullable(),
    language: t.string().nullable(),
    joinedAt: t.number()
  }
}

// The schema's inferred row is looser than the domain type (every column is
// `T | undefined`); the service narrows it at the repo seam.
type ISubscriberRow = ValueOf<typeof SubscriberSchema>

export class SubscriberService {
  constructor(private readonly subs: LmdbEnvSub<typeof SubscriberSchema>) {}

  async subscribe(id: number, data: Omit<IVSubscriber, `id` | `joinedAt`>): Promise<{subscriber: IVSubscriber; created: boolean}> {
    return this.subs.owner.transaction(async () => {
      const existing = this.subs.get(id)
      if (existing) {
        const updated: IVSubscriber = {
          id,
          joinedAt: existing.joinedAt ?? Date.now(),
          userName: data.userName ?? existing.userName,
          fullName: data.fullName ?? existing.fullName,
          language: data.language ?? existing.language
        }
        await this.subs.put(id, updated as unknown as ISubscriberRow)
        return {subscriber: updated, created: false}
      }

      const now = Date.now()
      const subscriber: IVSubscriber = {id, joinedAt: now, ...data}
      await this.subs.put(id, subscriber as unknown as ISubscriberRow)
      return {subscriber, created: true}
    })
  }

  async unsubscribe(id: number): Promise<boolean> {
    return this.subs.delete(id)
  }

  async isSubscribed(id: number): Promise<boolean> {
    return this.subs.has(id)
  }

  async total(): Promise<number> {
    return this.subs.count()
  }

  async list(): Promise<IVSubscriber[]> {
    const entries = await this.subs.entries()
    return entries.map(([, v]) => v as unknown as IVSubscriber).sort((a, b) => a.joinedAt - b.joinedAt)
  }
}
