import type {LmdbEnvSub} from "@gramstax/lmdb"
import type {SequenceSchema} from "../schema/sequence"

export class SequenceRepository {
  constructor(private readonly seq: LmdbEnvSub<typeof SequenceSchema>) {}

  ensure(userId: number) {
    if (!this.seq.has(userId)) {
      this.seq.putSync(userId, {seq: 0, count: 0})
    }
  }

  nextId(userId: number) {
    return this.seq.owner.transaction(async () => {
      const data = this.seq.get(userId) ?? {seq: 0, count: 0}
      const next = (data.seq ?? 0) + 1
      await this.seq.put(userId, {...data, seq: next})
      return `${next}`
    })
  }

  total(userId: number) {
    return this.seq.get(userId)?.count ?? 0
  }

  incrCount(userId: number) {
    return this.seq.owner.transaction(async () => {
      const data = this.seq.get(userId)
      if (data) {
        await this.seq.put(userId, {...data, count: (data.count ?? 0) + 1})
      }
    })
  }

  decrCount(userId: number) {
    return this.seq.owner.transaction(async () => {
      const data = this.seq.get(userId)
      if (data) {
        await this.seq.put(userId, {...data, count: Math.max(0, (data.count ?? 0) - 1)})
      }
    })
  }

  reset(userId: number) {
    return this.seq.delete(userId)
  }
}
