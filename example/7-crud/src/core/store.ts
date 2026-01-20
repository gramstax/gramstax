import {open} from "lmdb"

export type TodoItem = {
  id: number
  title: string
  description: string
  createdAt: number
}

const KEY_ITEM = (id: number) => `item:${id}`
const KEY_INDEX_IDS = `index:ids`
const KEY_COUNTER_ID = `counter:id`

export class CrudStore {
  private db

  constructor() {
    this.db = open({
      path: `./database`,
      compression: true
    })
  }

  createItem(title: string, description: string) {
    const counter = this.db.get(KEY_COUNTER_ID) ?? `0`
    const id = Number(counter) + 1
    const item: TodoItem = {
      id,
      title,
      description,
      createdAt: Date.now()
    }

    this.db.put(KEY_ITEM(id), JSON.stringify(item))
    this.db.put(KEY_COUNTER_ID, String(id))

    const ids = this.db.get(KEY_INDEX_IDS)
    const idList: number[] = ids ? JSON.parse(ids) : []
    idList.push(id)
    this.db.put(KEY_INDEX_IDS, JSON.stringify(idList))

    return item
  }

  getItem(id: number) {
    const value = this.db.get(KEY_ITEM(id))
    if (!value) return null
    return JSON.parse(value) as TodoItem
  }

  updateItem(id: number, title: string, description: string) {
    const existing = this.getItem(id)
    if (!existing) return null

    const updated: TodoItem = {
      ...existing,
      title,
      description
    }

    this.db.put(KEY_ITEM(id), JSON.stringify(updated))
    return updated
  }

  deleteItem(id: number) {
    const existing = this.getItem(id)
    if (!existing) return null

    this.db.remove(KEY_ITEM(id))

    const ids = this.db.get(KEY_INDEX_IDS)
    const idList: number[] = ids ? JSON.parse(ids) : []
    const filtered = idList.filter((i) => i !== id)
    this.db.put(KEY_INDEX_IDS, JSON.stringify(filtered))

    return existing
  }

  listItems(limit?: number, offset = 0) {
    const ids = this.db.get(KEY_INDEX_IDS)
    const idList: number[] = ids ? JSON.parse(ids) : []
    const paginated = idList.slice(offset, limit !== undefined ? offset + limit : undefined)

    return paginated.map((id) => this.getItem(id)).filter((item): item is TodoItem => item !== null)
  }

  listCount() {
    const ids = this.db.get(KEY_INDEX_IDS)
    const idList: number[] = ids ? JSON.parse(ids) : []
    return idList.length
  }

  close() {
    this.db.close()
  }
}
