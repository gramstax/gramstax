import {LmdbEnv} from "@gramstax/lmdb"
import {ItemRepository} from "./repositories/item"
import {SequenceRepository} from "./repositories/sequence"
export type {IVItem} from "./repositories/item"

export class Db {
  env: LmdbEnv
  items!: ItemRepository
  sequences!: SequenceRepository

  constructor(storePath: string) {
    this.env = new LmdbEnv({path: storePath, maxDbs: 5, compression: true})
  }

  async init() {
    if (this.items) return
    await this.env.open()
    this.items = this.env.register(ItemRepository)
    this.sequences = this.env.register(SequenceRepository)
  }
}
