import {Gramstax} from "gramstax"
import {BankGuard} from "~/guards/bank"
import {StatusPage} from "~/pages/status"
import {CtxCore} from "./ctx"
import {BankStore} from "./store"

// BotCore wires hooks and shared stores.
export class BotCore extends Gramstax {
  bankStore = new BankStore()

  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore({
      ct,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      bankStore: this.bankStore,
      temp: {
        isAnswer: false,
        session: {},
        data: {}
      }
    })
  }

  async hookBeforeRoute(ctx: CtxCore) {
    BankGuard.ensureAccount(ctx)
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).bnotFound.show()
  }
}
