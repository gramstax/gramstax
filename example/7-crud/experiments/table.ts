// db-table.ts
import type {RootDatabase} from "lmdb"

export class DbTable<S extends Record<string, (v?: any) => any>> {
  public readonly prefix: string
  private schema: S
  private db: RootDatabase | null = null

  constructor(prefix: string, schema: S) {
    this.prefix = prefix
    this.schema = schema
  }

  setDatabase(db: RootDatabase): void {
    this.db = db
  }

  private getDb(): RootDatabase {
    if (!this.db) {
      throw new Error(`Database not initialized. Call setDatabase() first.`)
    }
    return this.db
  }

  getKey(id: string | number): string {
    return `${this.prefix}:${id}`
  }

  getIndexKey(field: string, value: any): string {
    return `${this.prefix}:idx:${field}:${value}`
  }

  applyDefaults(data: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {}
    for (const key in this.schema) {
      result[key] = this.schema[key](data[key])
    }
    return result
  }

  async insert(id: string | number, data: Record<string, any>): Promise<Record<string, any>> {
    const record = this.applyDefaults(data)
    const key = this.getKey(id)
    await this.getDb().put(key, record)
    return record
  }

  async get(id: string | number): Promise<Record<string, any> | null> {
    const key = this.getKey(id)
    const data = await this.getDb().get(key)
    return data || null
  }

  async update(id: string | number, data: Record<string, any>): Promise<Record<string, any> | null> {
    const existing = await this.get(id)
    if (!existing) return null

    const updated = this.applyDefaults({...existing, ...data})
    const key = this.getKey(id)
    await this.getDb().put(key, updated)
    return updated
  }

  async delete(id: string | number): Promise<boolean> {
    const key = this.getKey(id)
    return await this.getDb().remove(key)
  }

  async createIndex(id: string | number, field: string, value: any): Promise<void> {
    const indexKey = this.getIndexKey(field, value)
    const ids = (await this.getDb().get(indexKey)) || []

    if (!ids.includes(id)) {
      ids.push(id)
      await this.getDb().put(indexKey, ids)
    }
  }

  async findByIndex(field: string, value: any): Promise<Record<string, any>[]> {
    const indexKey = this.getIndexKey(field, value)
    const ids: (string | number)[] = (await this.getDb().get(indexKey)) || []

    const results: Record<string, any>[] = []
    for (const id of ids) {
      const record = await this.get(id)
      if (record) results.push(record)
    }

    return results
  }

  async getAll(): Promise<Record<string, any>[]> {
    const db = this.getDb()
    const results: Record<string, any>[] = []

    for (const {key, value} of db.getRange({
      start: `${this.prefix}:`,
      end: `${this.prefix}:\uffff`
    })) {
      if (key.startsWith(this.prefix + `:`) && !key.includes(`:idx:`)) {
        results.push(value)
      }
    }

    return results
  }

  async deleteIndex(id: string | number, field: string, value: any): Promise<void> {
    const indexKey = this.getIndexKey(field, value)
    const ids: (string | number)[] = (await this.getDb().get(indexKey)) || []

    const filtered = ids.filter((existingId) => existingId !== id)

    if (filtered.length > 0) {
      await this.getDb().put(indexKey, filtered)
    } else {
      await this.getDb().remove(indexKey)
    }
  }
}
