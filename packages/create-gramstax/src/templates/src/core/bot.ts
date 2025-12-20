import { Gramstax } from "gramstax"
import { UserGuard } from "~/guards"
import { GeneralErrorPage } from "~/pages/general-error"
import { GeneralErrorInputNotFoundPage } from "~/pages/general-error-input-notfound"
import type { CtxCore } from "./ctx"

export class BotCore extends Gramstax {
  public async hookBeforeRoute(ctx: CtxCore): Promise<boolean> {
    const result = await new UserGuard(ctx).ensureValid(true)
    if (result === null) {
      return false
    }
    return true
  }

  public async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean): Promise<void> {
    await new GeneralErrorPage(ctx).transition(this.constructor.name, listenerName, error, isEdit)
  }

  public async hookErrorInputNotFoundPage(ctx: CtxCore): Promise<void> {
    await new GeneralErrorInputNotFoundPage(ctx).transition()
  }
}
