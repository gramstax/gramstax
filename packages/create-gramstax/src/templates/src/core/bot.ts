import {Gramstax} from "gramstax"
import {UserGuard} from "~/guards/user"
import {StatusPage} from "~/pages/status"
import type {IErrorPageData} from "~/types/page"
import type {CtxCore} from "./ctx"
import {ServicesCore} from "./services"

export class BotCore extends Gramstax {
  async hookAfterStart() {
    await ServicesCore.start()
  }

  async hookBeforeRoute(ctx: CtxCore) {
    const result = await new UserGuard(ctx).ensureUsername()
    return result === null ? false : true
  }

  async hookErrorPage(ctx: CtxCore, data: IErrorPageData) {
    await new StatusPage(ctx).gerror.show(`${data.listenerName}:hookErrorPage`, data.error)
  }

  async hookNotFoundPage(ctx: CtxCore) {
    await new StatusPage(ctx).gnotFound.show()
  }

  /**
   * Shut the services down after Gramstax stops.
   *
   * The worker thread and the database both outlive a failed `super.stop()` on
   * purpose — a hung Telegram poll must not strand a live thread — so cleanup
   * runs in `finally`.
   */
  async stop() {
    try {
      await super.stop()
    } finally {
      await ServicesCore.stop()
    }
  }
}
