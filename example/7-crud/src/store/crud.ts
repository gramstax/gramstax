export type CrudItem = {
  id: string
  title: string
  description: string
  status: `todo` | `in-progress` | `done`
  createdAt: number
  updatedAt: number
}

export class CrudStore {
  private items = new Map<number, Map<string, CrudItem>>()
  private counters = new Map<number, number>()

  ensureUser(userId: number) {
    if (!this.items.has(userId)) {
      this.items.set(userId, new Map())
      this.counters.set(userId, 0)
    }
  }

  createItem(userId: number, title: string, description: string): CrudItem {
    this.ensureUser(userId)
    const id = this.nextId(userId)
    const now = Date.now()
    const item: CrudItem = {id, title, description, status: `todo`, createdAt: now, updatedAt: now}
    this.items.get(userId)!.set(id, item)
    return item
  }

  listItems(userId: number): CrudItem[] {
    this.ensureUser(userId)
    return Array.from(this.items.get(userId)!.values()).sort((a, b) => a.createdAt - b.createdAt)
  }

  getItem(userId: number, id: string): CrudItem | null {
    this.ensureUser(userId)
    return this.items.get(userId)!.get(id) || null
  }

  updateItem(userId: number, id: string, title: string, description: string, status?: CrudItem[`status`]): CrudItem | null {
    const item = this.getItem(userId, id)
    if (!item) return null
    const updated: CrudItem = {
      ...item,
      title,
      description,
      status: status ?? item.status,
      updatedAt: Date.now()
    }
    this.items.get(userId)!.set(id, updated)
    return updated
  }

  deleteItem(userId: number, id: string): boolean {
    this.ensureUser(userId)
    return this.items.get(userId)!.delete(id)
  }

  formatTimestamp(ts: number) {
    return new Date(ts).toISOString().replace(`T`, ` `).slice(0, 19)
  }

  private nextId(userId: number) {
    const next = (this.counters.get(userId) || 0) + 1
    this.counters.set(userId, next)
    return `${next}`
  }
}
