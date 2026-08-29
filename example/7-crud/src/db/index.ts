import {LmdbEnv} from "@gramstax/lmdb"
import {ItemRepository} from "./repositories/item"
import {SequenceRepository} from "./repositories/sequence"
import {ItemSchema} from "./schema/item"
import {SequenceSchema} from "./schema/sequence"

export class Db extends LmdbEnv {
  items!: ItemRepository
  sequences!: SequenceRepository

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 5, compression: true})
  }

  async init() {
    if (this.items) return
    this.sequences = new SequenceRepository(this.register(SequenceSchema))
    this.items = new ItemRepository(this.register(ItemSchema), this.sequences)
  }
}
