import {Gramstax} from "gramstax"
import {GeneralStatusPage} from "~/pages/general-status"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  // Centralized error handling for page failures.
  async hookErrorPage(ctx, listenerName, error, isEdit) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  // Fallback when no route matches.
  async hookErrorInputNotFoundPage(ctx) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
