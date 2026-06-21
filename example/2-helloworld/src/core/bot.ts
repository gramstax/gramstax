import {Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {GeneralStatusPage} from "~/pages/general-status"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  // Centralized error handling for page failures.
  async hookErrorPage(ctx: CtxCore, data: NonNullable<Parameters<NonNullable<Gramstax[`hookErrorPage`]>>[1]>) {
    await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  // Fallback when no route matches.
  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).showErrorInputNotFound()
  }
}
