import {CtxCore} from "../core/ctx.js"

export class GuardBase extends CtxCore {
  constructor(ctx) {
    super(ctx)
    if (ctx?.data) {
      // save as temporary because guard should not save this.data or class.data because it is intended for Page only.
      this.temp.data = ctx.data
    }
  }
}
