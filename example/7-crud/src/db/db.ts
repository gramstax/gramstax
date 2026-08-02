import {LmdbEnv} from "@gramstax/lmdb"
import {ItemRepository} from "./repositories/item"
import {SequenceRepository} from "./repositories/sequence"

export type {IVItem} from "./repositories/item"

export class Db extends LmdbEnv {
  items!: ItemRepository
  sequences!: SequenceRepository

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 5, compression: true})
  }

  async init() {
    if (this.items) return
    this.items = this.register(ItemRepository)
    this.sequences = this.register(SequenceRepository)
  }
}
