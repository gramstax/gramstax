import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {StatusPage} from "~/pages/status"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    const result = await new UserGuard(ctx).ensureUsername()
    return result !== null
  }

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).gnotFound.show()
  }
}
