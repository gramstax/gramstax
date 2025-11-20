import { Ctx, CacheExternal } from "gramstax"

export class CtxCore extends Ctx {
  public cacheData: CacheExternal
  public constructor(params: ConstructorParameters<typeof Ctx>[0] & { cacheData: CacheExternal }) {
    super({ ...params })
    this.cacheData = params.cacheData
  }
}
