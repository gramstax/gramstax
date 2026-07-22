import {CtxCore} from "~/core/ctx"

export abstract class GuardBase extends CtxCore {
  constructor(ctx: CtxCore) {
    super({
      ct: ctx,
      cacheSession: ctx.cacheSession,
      cacheKeyboard: ctx.cacheKeyboard,
      templateManager: ctx.templateManager,
      temp: ctx.temp
    })
    if (ctx?.data) {
      // save as temporary because guard should not save this.data or class.data because it is intended for Page only.
      this.temp.data = ctx.data
    }
  }
}
