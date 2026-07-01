import {LmdbRepository} from "@gramstax/lmdb"

export type IVSequence = {
  seq: number
  count: number
}

export class SequenceRepository extends LmdbRepository<IVSequence, number> {
  static dbName = `sequences`

  async ensure(userId: number) {
    if (!(await this.has(userId))) {
      await this.set(userId, {seq: 0, count: 0})
    }
  }

  async nextId(userId: number): Promise<string> {
    return this._env.transaction(async () => {
      const data = (await this.get(userId)) ?? {seq: 0, count: 0}
      const next = data.seq + 1
      await this.set(userId, {...data, seq: next})
      return `${next}`
    })
  }

  async total(userId: number): Promise<number> {
    return (await this.get(userId))?.count ?? 0
  }

  async incrCount(userId: number) {
    return this._env.transaction(async () => {
      const data = await this.get(userId)
      if (data) await this.set(userId, {...data, count: data.count + 1})
    })
  }

  async decrCount(userId: number) {
    return this._env.transaction(async () => {
      const data = await this.get(userId)
      if (data) await this.set(userId, {...data, count: Math.max(0, data.count - 1)})
    })
  }

  async reset(userId: number) {
    await this.delete(userId)
  }
}
