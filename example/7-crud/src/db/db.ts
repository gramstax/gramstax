import {LmdbEnv} from "@gramstax/lmdb"
import {ItemRepository} from "./repositories/item"
import {SequenceRepository} from "./repositories/sequence"
import type {IVItem} from "./repositories/item"

export type {IVItem as MainItem}

export class MainDb {
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
