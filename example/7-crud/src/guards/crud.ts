import type {CtxCore} from "~/core/ctx"

export class CrudGuard {
  static ensureUser(ctx: CtxCore) {
    ctx.crudStore.ensureUser(ctx.userId)
    return true
  }
}
