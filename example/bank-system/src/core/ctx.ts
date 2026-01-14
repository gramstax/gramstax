import {Ctx, type CacheExternal} from "gramstax"
import type {BankStore} from "./store"

// Shared context for bank-system pages.
export class CtxCore extends Ctx {
  cacheState: CacheExternal
  bankStore: BankStore

  constructor(params: ConstructorParameters<typeof Ctx>[0] & {cacheState: CacheExternal; bankStore: BankStore}) {
    super({...params})
    this.cacheState = params.cacheState
    this.bankStore = params.bankStore

    this.bankStore.registerUser(this.userId, this.userName)
  }
}
