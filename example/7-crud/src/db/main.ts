import {open} from "lmdb"

export type MainItem = {
  id: string
  title: string
  description: string
  status: `todo` | `in-progress` | `done`
  createdAt: number
  updatedAt: number
}

export class MainDb {
  private db: ReturnType<typeof open>

  constructor(storePath: string) {
    this.db = open(storePath, {compression: true, sharedStructuresKey: Symbol.for(`structures`)})
  }

  async ensureUser(userId: number) {
    const counterKey = this.counterKey(userId)
    if (this.db.get(counterKey) == null) {
      await this.db.put(counterKey, 0)
    }
    const countKey = this.countKey(userId)
    if (this.db.get(countKey) == null) {
      const prefix = this.itemPrefix(userId)
      const count = this.db.getKeysCount({start: prefix, end: `${prefix}~`})
      await this.db.put(countKey, count)
    }
  }

  async createItem(userId: number, title: string, description: string): Promise<MainItem> {
    await this.ensureUser(userId)
    const id = await this.nextId(userId)
    const now = Date.now()
    const item: MainItem = {id, title, description, status: `todo`, createdAt: now, updatedAt: now}
    await this.db.put(this.itemKey(userId, id), item)
    const countKey = this.countKey(userId)
    const currentCount = (this.db.get(countKey) as number) || 0
    await this.db.put(countKey, currentCount + 1)
    return item
  }

  async listItems(userId: number, options?: {limit?: number; offset?: number}): Promise<MainItem[]> {
    await this.ensureUser(userId)
    const items = this.listAllItems(userId)
    const limit = options?.limit
    const offset = options?.offset ?? 0
    if (limit == null && offset === 0) return items
    return items.slice(offset, limit == null ? undefined : offset + limit)
  }

  async countItems(userId: number): Promise<number> {
    await this.ensureUser(userId)
    return (this.db.get(this.countKey(userId)) as number) || 0
  }

  async getItem(userId: number, id: string): Promise<MainItem | null> {
    await this.ensureUser(userId)
    return (this.db.get(this.itemKey(userId, id)) as MainItem | undefined) || null
  }

  async updateItem(userId: number, id: string, title: string, description: string, status?: MainItem[`status`]): Promise<MainItem | null> {
    const item = await this.getItem(userId, id)
    if (!item) return null
    const updated: MainItem = {
      ...item,
      title,
      description,
      status: status ?? item.status,
      updatedAt: Date.now()
    }
    await this.db.put(this.itemKey(userId, id), updated)
    return updated
  }

  async deleteItem(userId: number, id: string): Promise<boolean> {
    await this.ensureUser(userId)
    const removed = await this.db.remove(this.itemKey(userId, id))
    if (removed) {
      const countKey = this.countKey(userId)
      const currentCount = (this.db.get(countKey) as number) || 0
      await this.db.put(countKey, Math.max(0, currentCount - 1))
    }
    return removed
  }

  async clearAll(userId: number) {
    const prefix = this.itemPrefix(userId)
    for (const {key} of this.db.getRange({start: prefix, end: `${prefix}~`})) {
      await this.db.remove(key)
    }
    await this.db.remove(this.counterKey(userId))
    await this.db.remove(this.countKey(userId))
  }

  private itemKey(userId: number, id: string) {
    return `item:${userId}:${id}`
  }

  private itemPrefix(userId: number) {
    return `item:${userId}:`
  }

  private counterKey(userId: number) {
    return `counter:${userId}`
  }

  private countKey(userId: number) {
    return `count:${userId}`
  }

  private listAllItems(userId: number): MainItem[] {
    const prefix = this.itemPrefix(userId)
    const items: MainItem[] = []
    for (const {value} of this.db.getRange({start: prefix, end: `${prefix}~`})) {
      if (value) items.push(value as MainItem)
    }
    return items.sort((a, b) => a.createdAt - b.createdAt)
  }

  private async nextId(userId: number) {
    const counterKey = this.counterKey(userId)
    const current = this.db.get(counterKey)
    const next = (typeof current === `number` ? current : 0) + 1
    await this.db.put(counterKey, next)
    return `${next}`
  }
}
