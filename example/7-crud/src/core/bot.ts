import {Env} from "~/env"
import {MainDb} from "~/db/main"
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

  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
