import {Ctx, type CacheExternal} from "gramstax"

export class CtxCore extends Ctx {
  cacheData: CacheExternal

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {cacheData: CacheExternal}) {
    super({...params})
    this.cacheData = params.cacheData
  }
}
