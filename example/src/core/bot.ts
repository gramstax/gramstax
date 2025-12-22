import { CtxCore } from "./ctx"
import { UserGuard } from "~/guards/user"
import { GeneralErrorPage } from "~/pages/general-error"
import { Gramstax, CacheExternal } from "gramstax"
import { GeneralErrorInputNotFoundPage } from "~/pages/general-error-input-notfound"

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

  public async hookBeforeRoute(ctx: CtxCore) {
    const user = await new UserGuard(ctx).ensureValid()
    if (user === null) {
      return false
    }
    return true
  }

  public async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralErrorPage(ctx).transition(listenerName, `hookErrorPage`, error, isEdit)
  }

  public async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralErrorInputNotFoundPage(ctx).transition()
  }
}
