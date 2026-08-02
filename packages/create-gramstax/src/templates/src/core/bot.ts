import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {StatusPage} from "~/pages/status"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    const result = await new UserGuard(ctx).ensureUsername(false)
    if (result === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).bnotFound.show()
  }
}
