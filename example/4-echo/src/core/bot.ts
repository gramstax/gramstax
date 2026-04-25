import {Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {GeneralStatusPage} from "~/pages/general-status"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  // Centralized error handling for page failures.
  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).error(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  // Fallback when no route matches.
  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).errorInputNotFound()
  }
}
