import {LmdbEnv, type LmdbEnvSub} from "@gramstax/lmdb"
import {SubscriberSchema, SubscriberService} from "./repositories/subscriber"

export type {IVSubscriber as ISubscriber} from "./repositories/subscriber"

export class Db extends LmdbEnv {
  subs!: SubscriberService

  constructor(storePath: string) {
    super({path: storePath, maxDbs: 5, compression: true})
  }

  async init() {
    if (this.subs) return
    const subscribers: LmdbEnvSub<typeof SubscriberSchema> = this.register(SubscriberSchema)
    this.subs = new SubscriberService(subscribers)
  }
}
