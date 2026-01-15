import {Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {BankStore} from "./store"
import {BankGuard} from "~/guards/bank"
import {GeneralStatusPage} from "~/pages/general-status"

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

  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
