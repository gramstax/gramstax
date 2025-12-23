import { Ctx } from "gramstax"
import type { ExternalCache } from "~/cache/external"

export class CtxCore extends Ctx {
  public cacheData: ExternalCache
  public constructor(params: ConstructorParameters<typeof Ctx>[0] & { cacheData: ExternalCache }) {
    super({ ...params })
    this.cacheData = params.cacheData
  }
}
