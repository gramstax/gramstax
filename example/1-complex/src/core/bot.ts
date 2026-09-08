import {CacheExternal, Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {IncrementJob} from "~/jobs/increment"
import {StatusPage} from "~/pages/status"
import {CtxCore} from "./ctx"

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
    const user = await new UserGuard(ctx).overrideLang()
    if (user === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).gnotFound.show()
  }
}
