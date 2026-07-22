import {Env} from "~/env"
import type {CtxCore} from "~/core/ctx"

export class AdminGuard {
  static isAdmin(ctx: CtxCore) {
    return Env.TELEGRAM_ADMIN_IDS.includes(ctx.from?.id)
  }
}
