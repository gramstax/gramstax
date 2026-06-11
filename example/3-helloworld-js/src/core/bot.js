import {Gramstax} from "gramstax"
import {GeneralStatusPage} from "../pages/general-status.js"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  // Centralized error handling for page failures.
  async hookErrorPage(ctx, data) {
    await new GeneralStatusPage(ctx).showError(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  // Fallback when no route matches.
  async hookErrorInputNotFoundPage(ctx) {
    await new GeneralStatusPage(ctx).showErrorInputNotFound()
  }
}
