import {env} from "~/env"
import type {CtxCore} from "~/core/ctx"

export class AdminGuard {
  static isAdmin(ctx: CtxCore) {
    return env.TELEGRAM_ADMIN_IDS.includes(ctx.userId)
  }
}
