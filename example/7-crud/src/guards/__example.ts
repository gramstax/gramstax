import type {CtxCore} from "~/core/ctx"

export class ExampleGuard {
  static ensureInitialized(ctx: CtxCore) {
    return true
  }
}
