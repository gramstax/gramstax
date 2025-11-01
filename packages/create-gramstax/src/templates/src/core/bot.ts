import { Gramstax, type Ctx } from "gramstax"
import { UserGuard } from "../guards/user"
import { GeneralErrorPage } from "../pages/general-error"
import { GeneralErrorInputNotFoundPage } from "../pages/general-error-input-notfound"

export class BotCore extends Gramstax {
  public async hookBeforeRoute(ctx: Ctx): Promise<boolean> {
    const result = await new UserGuard({ ctx }).ensureValid(true)
    if (result === null) {
      return false
    }
    return true
  }

  public async hookErrorPage(ctx: Ctx, listenerName: string, error: any, isEdit: boolean): Promise<void> {
    await new GeneralErrorPage(ctx).transition(this.constructor.name, listenerName, error, isEdit)
  }

  public async hookErrorInputNotFoundPage(ctx: Ctx): Promise<void> {
    await new GeneralErrorInputNotFoundPage(ctx).transition()
  }
}
