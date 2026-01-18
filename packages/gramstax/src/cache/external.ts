import {Keyv} from "keyv"
import KeyvRedis from "@keyv/redis"

type IMore = Omit<Required<ConstructorParameters<typeof Keyv>>[0], `store` | `namespace` | `ttl`> & {forceStore?: any}

export class CacheExternal extends Keyv {
  constructor(
    public url: string = `memory`,
    ttl?: number,
    namespace?: string,
    more?: IMore
  ) {
    let store: any
    if (url.startsWith(`redis`)) store = new KeyvRedis(url)
    if (url === `memory`) store = new Map()
    if (more?.forceStore) store = more.forceStore

    super({store, namespace, ttl})
  }

  refreshLruCache(maxLength?: number) {
    const store = this.store as Map<any, any>
    const nsLen = this.opts.namespace ? this.opts.namespace?.length + 1 : null
    const keys = store.keys().toArray()
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]
      if (i == maxLength) {
        return
      }
      this.get(nsLen ? k.slice(nsLen) : k)
    }
  }
}
