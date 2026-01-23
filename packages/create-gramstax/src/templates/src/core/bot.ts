import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {GeneralStatusPage} from "~/pages/general-status"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookBeforeRoute(ctx: CtxCore) {
    const result = await new UserGuard(ctx).ensureUsername(true)
    if (result === null) {
      return false
    }
    return true
  }

  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
