import {LmdbEnv} from "@gramstax/lmdb"
import {SubscriberRepository} from "./repositories/subscriber"

export type {IVSubscriber as ISubscriber} from "./repositories/subscriber"

export class Db extends LmdbEnv {
  subs!: SubscriberRepository

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 5, compression: true})
  }

  async init() {
    await this.open()
    this.subs = this.register(SubscriberRepository)
  }
}
