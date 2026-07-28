import {Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {StatusPage} from "~/pages/status"

export class BotCore extends Gramstax {
  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).berrorInputNotFound.show()
  }
}
