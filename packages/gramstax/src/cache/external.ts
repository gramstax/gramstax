import { Keyv } from "keyv"
import KeyvRedis from "@keyv/redis"

type IMore = Omit<Required<ConstructorParameters<typeof Keyv>>[0], `store` | `namespace` | `ttl`> & { forceStore?: any }

export class CacheExternal extends Keyv {
  constructor(public url: string | `memory` = `memory`, namespace?: string, ttl?: number, more?: IMore) {
    let store: any
    if (url.startsWith(`redis`)) store = new KeyvRedis(url)
    if (url === `memory`) store = new Map()
    if (more?.forceStore) store = more.forceStore

    super({ store, namespace, ttl })
  }
}
