import type {CtxCore} from "~/core/ctx"

export class CrudGuard {
  static async ensureUser(ctx: CtxCore) {
    await ctx.db.init()
    ctx.db.sequences.ensure(ctx.userId)
    return true
  }
}
