import {Gramstax} from "gramstax"
import {StatusPage} from "~/pages/status"
import type {CtxCore} from "./ctx"

export class BotCore extends Gramstax {
  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).gnotFound.show()
  }
}
