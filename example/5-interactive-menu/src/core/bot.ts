import {CacheExternal, Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {StatusPage} from "~/pages/status"

// BotCore wires Gramstax hooks and custom context.
export class BotCore extends Gramstax {
  cacheState = new CacheExternal(`memory`)

  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore({
      ct,
      cacheState: this.cacheState,
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

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).berrorInputNotFound.show()
  }
}
