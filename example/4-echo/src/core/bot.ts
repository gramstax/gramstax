import {Gramstax} from "gramstax"
import {StatusPage} from "~/pages/status"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).bnotFound.show()
  }
}
