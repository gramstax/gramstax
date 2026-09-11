import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {SequenceSchema} from "../schema/sequence"

export class SequenceRepository {
  constructor(private readonly env: LmdbEnvSub<typeof SequenceSchema>) {}

  ensure(userId: number) {
    return this.env.putIfNotExists(userId, {seq: 0, count: 0})
  }

  nextId(userId: number) {
    return this.env.owner.transaction(() => {
      const data = this.env.get(userId) ?? {seq: 0, count: 0}
      const next = (data.seq ?? 0) + 1
      this.env.put(userId, {...data, seq: next})
      return `${next}`
    })
  }

  total(userId: number) {
    return this.env.get(userId)?.count ?? 0
  }

  incrCount(userId: number) {
    return this.env.owner.transaction(() => {
      const data = this.env.get(userId)
      if (data) {
        this.env.put(userId, {...data, count: (data.count ?? 0) + 1})
      }
    })
  }

  decrCount(userId: number) {
    return this.env.owner.transaction(() => {
      const data = this.env.get(userId)
      if (data) {
        this.env.put(userId, {...data, count: Math.max(0, (data.count ?? 0) - 1)})
      }
    })
  }

  reset(userId: number) {
    return this.env.delete(userId)
  }
}
