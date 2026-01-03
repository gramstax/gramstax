import {CtxCore} from "./ctx"
import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {CacheExternal} from "gramstax"
import {GeneralErrorPage} from "~/pages/general-error"
import {GeneralErrorInputNotFoundPage} from "~/pages/general-error-input-notfound"

export class BotCore extends Gramstax {
  cacheData = new CacheExternal(`memory`)

  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
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

  async hookBeforeRoute(ctx: CtxCore) {
    const user = await new UserGuard(ctx).ensureValid()
    if (user === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralErrorPage(ctx).transition(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralErrorInputNotFoundPage(ctx).transition()
  }
}
