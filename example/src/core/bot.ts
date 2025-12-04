import { CtxCore } from "./ctx"
import { UserGuard } from "../guards/user"
import { Gramstax, CacheExternal } from "gramstax"

export class BotCore extends Gramstax {
  public cacheData = new CacheExternal(`memory`)

  public createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore({
      ct,
      cacheData: this.cacheData,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      temp: {
        session: {},
        data: {}
      }
    })
  }

  public async hookBeforeRoute(ctx: CtxCore, listenerName: string) {
    const user = await new UserGuard(ctx).ensureValid()
    if (user === null) {
      return false
    }
    return true
  }

  public async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    console.log(`call error page: ${error}`)
  }

  public async hookErrorInputNotFoundPage(ctx: CtxCore) {
    console.log(`call error input not found page`)
  }
}
