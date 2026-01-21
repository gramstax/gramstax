import {open} from "lmdb"

export type TodoItem = {
  id: number
  title: string
  description: string
  updatedAt: number
  createdAt: number
}

const KEY_ITEM_PREFIX = (userId: number) => `user:${userId}:item:`
const KEY_ITEM = (userId: number, id: number) => `${KEY_ITEM_PREFIX(userId)}${formatId(id)}`
const LIST_END_SUFFIX = `\uffff`
const ID_PAD_LENGTH = 14

const formatId = (id: number) => String(id).padStart(ID_PAD_LENGTH, `0`)

export class CrudStore {
  private db

  constructor() {
    this.db = open({path: `./database`, compression: true})

    // const open = open({path: `./database`, compression: true})

    setInterval(() => {
      const memoryUsageMB = Object.fromEntries(Object.entries(process.memoryUsage()).map(([key, value]) => [key, `${(value / (1024 * 1024)).toFixed(2)} MB`]))
      console.log(memoryUsageMB)
    }, 5000)
  }

  createItem(userId: number, title: string, description: string) {
    const id = this.getNextId(userId)
    const no = Date.now()
    const item: TodoItem = {id, title, description, updatedAt: no, createdAt: no}

    this.db.putSync(KEY_ITEM(userId, id), JSON.stringify(item))
    return item
  }

  getItem(userId: number, id: number) {
    const value = this.db.get(KEY_ITEM(userId, id))
    return value || null
  }

  updateItem(userId: number, id: number, title: string, description: string) {
    const existing = this.getItem(userId, id)
    if (!existing) return null

    const updated: TodoItem = {...existing, title, description}
    this.db.putSync(KEY_ITEM(userId, id), updated)
    return updated
  }

  deleteItem(userId: number, id: number) {
    const existing = this.getItem(userId, id)
    if (!existing) return null

    this.db.removeSync(KEY_ITEM(userId, id))
    return existing
  }

  listItems(userId: number, limit?: number, offset = 0) {
    const range = this.buildRange(userId, {limit, offset})
    const items: TodoItem[] = []
    for (const {key, value} of this.db.getRange(range)) {
      const id = key.toString().split(`:`)[3]
      const da = {id, ...value}
      items.push(da)
    }
    return items as TodoItem[]
  }

  listCount(userId: number) {
    const range = this.buildRange(userId)
    const count = this.db.getKeysCount(range)
    return count
  }

  close() {
    this.db.close()
  }

  private buildRange(userId: number, options: {limit?: number; offset?: number; reverse?: boolean} = {}) {
    const prefix = KEY_ITEM_PREFIX(userId)
    const range: {start: string; end: string; limit?: number; offset?: number; reverse?: boolean} = {
      start: prefix,
      end: `${prefix}${LIST_END_SUFFIX}`
    }

    if (options.limit !== undefined) range.limit = options.limit
    if (options.offset !== undefined) range.offset = options.offset
    if (options.reverse !== undefined) range.reverse = options.reverse
    return range
  }

  private getNextId(userId: number) {
    const range = this.buildRange(userId, {reverse: true, limit: 1})
    const count = this.db.getCount(range)
    return count || 1
  }
}
