import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {GeneralStatusPage} from "~/pages/general-status"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookBeforeStart() {
    this.bot.use(() => {})
  }

  async hookBeforeRoute(ctx: CtxCore) {
    const result = await new UserGuard(ctx).ensureUsername(false)
    if (result === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, data: Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]) {
    await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).showErrorInputNotFound()
  }
}
