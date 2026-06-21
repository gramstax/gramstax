import {Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {GeneralStatusPage} from "~/pages/general-status"

export class BotCore extends Gramstax {
  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).showErrorInputNotFound()
  }
}
