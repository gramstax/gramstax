import type {CtxCore} from "~/core/ctx"

export class CrudGuard {
  static async ensureUser(ctx: CtxCore) {
    ctx.db.sequences.ensure(ctx.from!.id!)
    return true
  }
}
