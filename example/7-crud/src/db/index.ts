import {LmdbEnv, type LmdbEnvSub} from "@gramstax/lmdb"
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
    const items: LmdbEnvSub<typeof ItemSchema> = this.register(ItemSchema)
    const sequences: LmdbEnvSub<typeof SequenceSchema> = this.register(SequenceSchema)
    this.sequences = new SequenceRepository(sequences)
    this.items = new ItemRepository(items, this.sequences)
  }
}
