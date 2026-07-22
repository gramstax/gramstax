import {Ctx, type CacheExternal} from "gramstax"

// Shared context for interactive menu pages.
export class CtxCore extends Ctx {
  cacheState: CacheExternal

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {cacheState: CacheExternal}) {
    super({...params})
    this.cacheState = params.cacheState ?? (params as any).ct?.cacheState
  }
}
