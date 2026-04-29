import type {CtxCore} from "~/core/ctx"

export class UserGuard {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async ensureUsername(_ctx: CtxCore) {
    return true
  }
}