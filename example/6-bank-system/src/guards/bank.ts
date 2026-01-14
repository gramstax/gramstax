import type {CtxCore} from "~/core/ctx"

export class BankGuard {
  static ensureAccount(ctx: CtxCore) {
    ctx.bankStore.registerUser(ctx.userId, ctx.userName)
    if (!ctx.bankStore.hasAccount(ctx.userId)) {
      ctx.bankStore.createAccount(ctx.userId)
    }

    return true
  }
}
