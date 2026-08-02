import {Gramstax} from "gramstax"
import {Db} from "~/db/db"
import {Env} from "~/env"
import {CrudGuard} from "~/guards/crud"
import {StatusPage} from "~/pages/status"
import {CtxCore} from "./ctx"

// BotCore wires hooks and shared stores.
export class BotCore extends Gramstax {
  db = new Db(Env.DB_PATH)

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
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).bnotFound.show()
  }
}
