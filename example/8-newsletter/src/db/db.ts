import {LmdbEnv} from "@gramstax/lmdb"
import {SubscriberRepository} from "./repositories/subscriber"

export type {IVSubscriber as ISubscriber} from "./repositories/subscriber"

export class Db {
  env: LmdbEnv
  subs!: SubscriberRepository

  constructor(storePath: string) {
    this.env = new LmdbEnv({path: storePath, maxDbs: 5, compression: true})
  }

  async init() {
    if (this.subs) return
    await this.env.open()
    this.subs = this.env.register(SubscriberRepository)
  }
}
