import {Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {CrudStore} from "../db"
import {GeneralStatusPage} from "~/pages/general-status"

// BotCore wires hooks and shared stores.
export class BotCore extends Gramstax {
  crudStore = new CrudStore()

  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore({
      ct,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      crudStore: this.crudStore,
      temp: {
        isAnswer: false,
        session: {},
        data: {}
      }
    })
  }

  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
