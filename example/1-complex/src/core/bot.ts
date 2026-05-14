import {CtxCore} from "./ctx"
import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {IncrementJob} from "~/jobs/increment"
import {CacheExternal} from "gramstax"
import {GeneralStatusPage} from "~/pages/general-status"

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
        isAnswer: false,
        session: {},
        data: {}
      }
    })
  }

  async hookAfterStart() {
    await IncrementJob.launchWorker([5000]) // 5s
  }

  async hookBeforeRoute(ctx: CtxCore) {
    const user = await new UserGuard(ctx).ensureValid()
    if (user === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).showError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).showErrorInputNotFound()
  }
}
