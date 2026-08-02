import type {CtxCore} from "~/core/ctx"
import {Env} from "~/env"

export class AdminGuard {
  static isAdmin(ctx: CtxCore) {
    return Env.TELEGRAM_ADMIN_IDS.includes(ctx.from?.id)
  }
}
