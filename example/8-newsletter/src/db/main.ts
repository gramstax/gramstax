import {open} from "lmdb"

export type ISubscriber = {
  id: number
  userName?: string
  fullName?: string
  language?: string
  joinedAt: number
}

export class MainDb {
  private db: ReturnType<typeof open>

  constructor(storePath: string) {
    this.db = open(storePath, {compression: true, sharedStructuresKey: Symbol.for(`structures`)})
  }

  async ensureMeta() {
    const countKey = this.countKey()
    if (this.db.get(countKey) == null) {
      const prefix = this.subPrefix()
      const count = this.db.getKeysCount({start: prefix, end: `${prefix}~`})
      await this.db.put(countKey, count)
    }
  }

  async isSubscribed(id: number) {
    return this.db.get(this.subKey(id)) != null
  }

  async subscribe(id: number, data: Omit<ISubscriber, `id` | `joinedAt`>) {
    await this.ensureMeta()
    const key = this.subKey(id)
    const existing = this.db.get(key) as ISubscriber | undefined
    if (existing) {
      const updated: ISubscriber = {...existing, ...data}
      await this.db.put(key, updated)
      return {subscriber: updated, created: false}
    }

    const now = Date.now()
    const subscriber: ISubscriber = {id, joinedAt: now, ...data}
    await this.db.put(key, subscriber)
    const currentCount = (this.db.get(this.countKey()) as number) || 0
    await this.db.put(this.countKey(), currentCount + 1)
    return {subscriber, created: true}
  }

  async unsubscribe(id: number) {
    await this.ensureMeta()
    const key = this.subKey(id)
    const removed = await this.db.remove(key)
    if (removed) {
      const currentCount = (this.db.get(this.countKey()) as number) || 0
      await this.db.put(this.countKey(), Math.max(0, currentCount - 1))
    }
    return removed
  }

  async countSubscribers() {
    await this.ensureMeta()
    return (this.db.get(this.countKey()) as number) || 0
  }

  async listSubscribers(): Promise<ISubscriber[]> {
    await this.ensureMeta()
    const prefix = this.subPrefix()
    const items: ISubscriber[] = []
    for (const {value} of this.db.getRange({start: prefix, end: `${prefix}~`})) {
      if (value) items.push(value as ISubscriber)
    }
    return items.sort((a, b) => a.joinedAt - b.joinedAt)
  }

  private subKey(id: number) {
    return `sub:${id}`
  }

  private subPrefix() {
    return `sub:`
  }

  private countKey() {
    return `count:subscribers`
  }
}
