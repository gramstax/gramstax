import { CtxCore } from "~/core"

export abstract class GuardBase extends CtxCore {
  public constructor(ctx: CtxCore) {
    super(ctx)
    if (ctx?.data) {
      // save as temporary because guard should not save this.data or class.data because it is intended for Page only.
      this.temp.data = ctx.data
    }
  }
}
