import {CacheExternal, Gramstax} from "gramstax"
import {CtxCore} from "./ctx"
import {GeneralStatusPage} from "~/pages/general-status"

// BotCore configures Gramstax hooks for this project.
export class BotCore extends Gramstax {
  cacheState = new CacheExternal(`memory`)

  // Ensure each page receives our custom context class.
  createCtx(ct: Parameters<Gramstax[`createCtx`]>[0]) {
    return new CtxCore({
      ct,
      cacheState: this.cacheState,
      cacheSession: this.cacheSession,
      cacheKeyboard: this.cacheKeyboard,
      templateManager: this.templateManager,
      temp: {
        isAnswer: false,
        session: {},
        data: {}
      }
    })
  }

  // Centralized error handling for page failures.
  async hookErrorPage(ctx: CtxCore, listenerName: string, error: any, isEdit: boolean) {
    await new GeneralStatusPage(ctx).toError(`${listenerName}:hookErrorPage`, error, isEdit)
  }

  // Fallback when no route matches.
  async hookErrorInputNotFoundPage(ctx: CtxCore) {
    await new GeneralStatusPage(ctx).toErrorInputNotFound()
  }
}
