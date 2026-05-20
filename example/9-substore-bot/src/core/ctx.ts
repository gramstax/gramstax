import {Ctx, type CacheExternal} from "gramstax"

export class CtxCore extends Ctx {
  cacheState: CacheExternal

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {cacheState: CacheExternal}) {
    super({...params})
    this.cacheState = params.cacheState
  }
}
