import {Gramstax} from "gramstax"
import {StatusPage} from "../pages/status.js"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  // Centralized error handling for page failures.
  async hookErrorPage(ctx, data) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  // Fallback when no route matches.
  async hookNotFoundPage(ctx) {
    await new StatusPage(ctx).gnotFound.show()
  }
}
