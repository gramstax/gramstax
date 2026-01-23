import {open} from "lmdb"

export type CrudItem = {
  id: string
  title: string
  description: string
  status: `todo` | `in-progress` | `done`
  createdAt: number
  updatedAt: number
}

export class CrudStore {
  private db: ReturnType<typeof open>

  constructor(storePath: string) {
    this.db = open(storePath, {compression: true, sharedStructuresKey: Symbol.for(`structures`)})
  }

  async ensureUser(userId: number) {
    const counterKey = this.counterKey(userId)
    if (this.db.get(counterKey) == null) {
      await this.db.put(counterKey, 0)
    }
  }

  async createItem(userId: number, title: string, description: string): Promise<CrudItem> {
    await this.ensureUser(userId)
    const id = await this.nextId(userId)
    const now = Date.now()
    const item: CrudItem = {id, title, description, status: `todo`, createdAt: now, updatedAt: now}
    await this.db.put(this.itemKey(userId, id), item)
    return item
  }

  async listItems(userId: number): Promise<CrudItem[]> {
    await this.ensureUser(userId)
    const prefix = this.itemPrefix(userId)
    const items: CrudItem[] = []
    for (const {value} of this.db.getRange({start: prefix, end: `${prefix}~`})) {
      if (value) items.push(value as CrudItem)
    }
    return items.sort((a, b) => a.createdAt - b.createdAt)
  }

  async getItem(userId: number, id: string): Promise<CrudItem | null> {
    await this.ensureUser(userId)
    return (this.db.get(this.itemKey(userId, id)) as CrudItem | undefined) || null
  }

  async updateItem(userId: number, id: string, title: string, description: string, status?: CrudItem[`status`]): Promise<CrudItem | null> {
    const item = await this.getItem(userId, id)
    if (!item) return null
    const updated: CrudItem = {
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
    return await this.db.remove(this.itemKey(userId, id))
  }

  formatTimestamp(ts: number) {
    return new Date(ts).toISOString().replace(`T`, ` `).slice(0, 19)
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

  private async nextId(userId: number) {
    const counterKey = this.counterKey(userId)
    const current = this.db.get(counterKey)
    const next = (typeof current === `number` ? current : 0) + 1
    await this.db.put(counterKey, next)
    return `${next}`
  }
}
