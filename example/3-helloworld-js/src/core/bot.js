import {Gramstax} from "gramstax"
import {StatusPage} from "../pages/status.js"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  // Centralized error handling for page failures.
  async hookErrorPage(ctx, data) {
    await new StatusPage(ctx).berror.show(`${data.listenerName}:hookErrorPage`, data.error, data.isEdit)
  }

  // Fallback when no route matches.
  async hookNotFoundPage(ctx) {
    await new StatusPage(ctx).bnotFound.show()
  }
}
