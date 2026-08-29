import {LmdbEnv} from "@gramstax/lmdb"
import {SubscriberRepository} from "./repositories/subscriber"
import {SubscriberSchema} from "./schema/subscriber"

export class Db extends LmdbEnv {
  subs!: SubscriberRepository

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 2, compression: true, encoding: `json`})
  }

  async init() {
    if (this.subs) return
    this.subs = new SubscriberRepository(this.register(SubscriberSchema))
  }
}
