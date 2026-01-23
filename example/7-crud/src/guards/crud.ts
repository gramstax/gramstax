import type {CtxCore} from "~/core/ctx"

export class CrudGuard {
  static async ensureUser(ctx: CtxCore) {
    await ctx.crudStore.ensureUser(ctx.userId)
    return true
  }
}
