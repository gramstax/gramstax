import {Env} from "~/env"
import {MainDb} from "~/db/db"
import {CtxCore} from "./ctx"
import {Gramstax} from "gramstax"
import {CrudGuard} from "~/guards/crud"
import {GeneralStatusPage} from "~/pages/general-status"

// BotCore wires hooks and shared stores.
export class BotCore extends Gramstax {
  db = new MainDb(Env.DB_PATH)

  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore({
      ct,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      db: this.db,
      temp: {
        isAnswer: false,
        session: {},
        data: {}
      }
    })
  }

  async hookBeforeRoute(ctx: CtxCore) {
    await CrudGuard.ensureUser(ctx)
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).showErrorInputNotFound()
  }
}
