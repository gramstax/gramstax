import {CtxCore} from "~/core/ctx"

export abstract class GuardBase extends CtxCore {
  constructor(ctx: CtxCore) {
    super(ctx)
    if (ctx?.data) {
      this.temp.data = ctx.data
    }
  }
}