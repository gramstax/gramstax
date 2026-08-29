import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {ItemSchema} from "../schema/item"
import type {IVItem} from "../schema/item"
import type {SequenceRepository} from "./sequence"

export class ItemRepository {
  constructor(
    private readonly items: LmdbEnvSub<typeof ItemSchema>,
    private readonly seq: SequenceRepository
  ) {}

  private key(userId: number, id: string) {
    return `${userId}:${id}`
  }

  private keyPrefix(userId: number) {
    return `${userId}:`
  }

  async create(userId: number, title: string, description: string): Promise<IVItem> {
    return this.items.owner.transaction(async () => {
      this.seq.ensure(userId)
      const id = await this.seq.nextId(userId)
      const now = Date.now()
      const item: IVItem = {id, title, description, status: `todo`, createdAt: now, updatedAt: now}
      await this.items.put(this.key(userId, id), item)
      await this.seq.incrCount(userId)
      return item
    })
  }

  async remove(userId: number, id: string): Promise<boolean> {
    return this.items.owner.transaction(async () => {
      const existed = await this.items.delete(this.key(userId, id))
      if (existed) await this.seq.decrCount(userId)
      return existed
    })
  }

  async purge(userId: number) {
    return this.items.owner.transaction(async () => {
      const prefix = this.keyPrefix(userId)
      const end = `${prefix}\uffff`
      const keys = await this.items.keys({start: prefix, end})
      await Promise.all(keys.map((k) => this.items.delete(k)))
      await this.seq.reset(userId)
    })
  }

  async total(userId: number): Promise<number> {
    return this.seq.total(userId)
  }

  async list(userId: number, options?: {limit?: number; offset?: number}): Promise<IVItem[]> {
    const prefix = this.keyPrefix(userId)
    const end = `${prefix}\uffff`
    const entries = await this.items.entries({start: prefix, end})
    const sorted = entries.map(([, v]) => v as IVItem).sort((a, b) => a.createdAt! - b.createdAt!)
    const limit = options?.limit
    const offset = options?.offset ?? 0
    if (limit == null && offset === 0) return sorted
    return sorted.slice(offset, limit == null ? undefined : offset + limit)
  }

  async fetch(userId: number, id: string): Promise<IVItem | null> {
    const item = this.items.get(this.key(userId, id))
    return (item as IVItem | undefined) ?? null
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
    await this.items.put(this.key(userId, id), updated)
    return updated
  }
}
