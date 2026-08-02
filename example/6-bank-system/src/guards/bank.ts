import type {CtxCore} from "~/core/ctx"

export class BankGuard {
  static ensureAccount(ctx: CtxCore) {
    ctx.bankStore.registerUser(ctx.from?.id, ctx.from?.username)
    if (!ctx.bankStore.hasAccount(ctx.from?.id)) {
      ctx.bankStore.createAccount(ctx.from?.id)
    }

    return true
  }
}
