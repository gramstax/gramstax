import {LmdbRepository} from "@gramstax/lmdb"
import {SequenceRepository} from "./sequence"

export type IVItem = {
  id: string
  title: string
  description: string
  status: `todo` | `in-progress` | `done`
  createdAt: number
  updatedAt: number
}

export class ItemRepository extends LmdbRepository<IVItem, string> {
  static dbName = `items`

  private get seq() {
    return this._env.getRepository(SequenceRepository)
  }

  private key(userId: number, id: string) {
    return `${userId}:${id}`
  }

  private keyPrefix(userId: number) {
    return `${userId}:`
  }

  async create(userId: number, title: string, description: string): Promise<IVItem> {
    return this._env.transaction(async () => {
      await this.seq.ensure(userId)
      const id = await this.seq.nextId(userId)
      const now = Date.now()
      const item: IVItem = {id, title, description, status: `todo`, createdAt: now, updatedAt: now}
      await this.set(this.key(userId, id), item)
      await this.seq.incrCount(userId)
      return item
    })
  }

  async remove(userId: number, id: string): Promise<boolean> {
    return this._env.transaction(async () => {
      const existed = await this.delete(this.key(userId, id))
      if (existed) await this.seq.decrCount(userId)
      return existed
    })
  }

  async purge(userId: number) {
    return this._env.transaction(async () => {
      const prefix = this.keyPrefix(userId)
      const end = `${prefix}\uffff`
      const keys = await this.keys({start: prefix, end})
      await Promise.all(keys.map((k) => this.delete(k)))
      await this.seq.reset(userId)
    })
  }

  async total(userId: number): Promise<number> {
    return this.seq.total(userId)
  }

  async list(userId: number, options?: {limit?: number; offset?: number}): Promise<IVItem[]> {
    const prefix = this.keyPrefix(userId)
    const end = `${prefix}\uffff`
    const entries = await this.entries({start: prefix, end})
    const sorted = entries.map(([_, v]) => v).sort((a, b) => a.createdAt - b.createdAt)
    const limit = options?.limit
    const offset = options?.offset ?? 0
    if (limit == null && offset === 0) return sorted
    return sorted.slice(offset, limit == null ? undefined : offset + limit)
  }

  async fetch(userId: number, id: string): Promise<IVItem | null> {
    const item = await this.get(this.key(userId, id))
    return item ?? null
  }

  async edit(userId: number, id: string, title: string, description: string, status?: IVItem[`status`]): Promise<IVItem | null> {
    const item = await this.fetch(userId, id)
    if (!item) return null
    const updated: IVItem = {
      ...item,
      title,
      description,
      status: status ?? item.status,
      updatedAt: Date.now()
    }
    await this.set(this.key(userId, id), updated)
    return updated
  }
}
